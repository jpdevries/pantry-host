/**
 * feed.pantryhost.app — AT Protocol Firehose Indexer
 *
 * Subscribes to the AT Protocol relay firehose and watches for
 * exchange.recipe.recipe creates/deletes in real-time. Stores only
 * DIDs and handles — never recipe content.
 *
 * Replaces the Cloudflare Worker + Cron approach that scraped
 * recipe.exchange. Now fully independent.
 *
 * API: GET /api/handles → JSON array of active recipe publishers
 *      GET /health      → { status: 'ok' }
 */

import express from 'express';
import Database from 'better-sqlite3';
import { Firehose } from '@atproto/sync';

const PORT = parseInt(process.env.PORT || '3002', 10);
const DB_PATH = process.env.DB_PATH || './data/registry.db';
const FIREHOSE_URL = process.env.FIREHOSE_URL || 'wss://bsky.network';
const LEXICON_RECIPE = 'exchange.recipe.recipe';
const LEXICON_COLLECTION = 'exchange.recipe.collection';

// ── Database ─────────────────────────────────────────────────

const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.exec(`
  CREATE TABLE IF NOT EXISTS recipe_publishers (
    did TEXT PRIMARY KEY,
    handle TEXT NOT NULL,
    recipe_count INTEGER DEFAULT 0,
    first_seen TEXT DEFAULT (datetime('now')),
    last_seen TEXT DEFAULT (datetime('now'))
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS cursor (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    seq INTEGER NOT NULL
  )
`);

const getCursor = db.prepare('SELECT seq FROM cursor WHERE id = 1');
const setCursorStmt = db.prepare(
  'INSERT INTO cursor (id, seq) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET seq = excluded.seq'
);
const upsertStmt = db.prepare(`
  INSERT INTO recipe_publishers (did, handle, recipe_count, last_seen)
  VALUES (?, ?, 1, datetime('now'))
  ON CONFLICT(did) DO UPDATE SET
    handle = excluded.handle,
    recipe_count = recipe_count + 1,
    last_seen = datetime('now')
`);
const decrementStmt = db.prepare(`
  UPDATE recipe_publishers
  SET recipe_count = MAX(0, recipe_count - 1), last_seen = datetime('now')
  WHERE did = ?
`);

function savedCursor(): number | undefined {
  const row = getCursor.get() as { seq: number } | undefined;
  return row?.seq;
}

// ── Handle resolution ────────────────────────────────────────

const handleCache = new Map<string, string>();

async function resolveHandle(did: string): Promise<string> {
  const cached = handleCache.get(did);
  if (cached) return cached;
  try {
    const res = await fetch(
      `https://bsky.social/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`
    );
    if (res.ok) {
      const body = (await res.json()) as { handle?: string };
      const handle = body.handle || did;
      handleCache.set(did, handle);
      return handle;
    }
  } catch {}
  return did;
}

// ── Firehose subscription ────────────────────────────────────

let eventsProcessed = 0;
let recipesFound = 0;

function startFirehose() {
  const cursor = savedCursor();
  console.log(`[firehose] Starting from cursor: ${cursor ?? 'latest'}`);

  const firehose = new Firehose({
    relay: FIREHOSE_URL,
    cursor,
    handleEvent: async (event) => {
      eventsProcessed++;

      if (event.event === 'create' || event.event === 'update') {
        const collection = event.collection;
        if (collection === LEXICON_RECIPE || collection === LEXICON_COLLECTION) {
          const handle = await resolveHandle(event.did);
          upsertStmt.run(event.did, handle);
          recipesFound++;
          console.log(`[firehose] +${collection === LEXICON_COLLECTION ? 'collection' : 'recipe'} from @${handle} (total: ${recipesFound})`);
        }
      } else if (event.event === 'delete') {
        const collection = event.collection;
        if (collection === LEXICON_RECIPE || collection === LEXICON_COLLECTION) {
          decrementStmt.run(event.did);
          console.log(`[firehose] -${collection === LEXICON_COLLECTION ? 'collection' : 'recipe'} from ${event.did}`);
        }
      }

      // Persist cursor periodically (every 1000 events)
      if (event.cursor && eventsProcessed % 1000 === 0) {
        setCursorStmt.run(event.cursor);
      }
    },
    onError: (err) => {
      console.error('[firehose] Error:', err);
    },
  });

  firehose.start();
  console.log('[firehose] Subscription started');

  // Persist cursor on shutdown
  process.on('SIGINT', () => {
    console.log('[firehose] Shutting down, saving cursor...');
    firehose.destroy();
    db.close();
    process.exit(0);
  });
  process.on('SIGTERM', () => {
    console.log('[firehose] SIGTERM received, saving cursor...');
    firehose.destroy();
    db.close();
    process.exit(0);
  });
}

// ── HTTP API ─────────────────────────────────────────────────

const app = express();

app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'feed.pantryhost.app',
    eventsProcessed,
    recipesFound,
  });
});

const listHandles = db.prepare(
  'SELECT did, handle, recipe_count FROM recipe_publishers WHERE recipe_count > 0 ORDER BY recipe_count DESC'
);

app.get('/api/handles', (_req, res) => {
  const rows = listHandles.all();
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(rows);
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] Listening on port ${PORT}`);
  startFirehose();
});
