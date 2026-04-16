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

// ── Nearby markets (Overpass proxy) ─────────────────────────

const OVERPASS_URLS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

function toSlug(name: string): string {
  return name.toLowerCase().replace(/['']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

app.get('/api/nearby', async (req, res) => {
  const lat = parseFloat(req.query.lat as string);
  const lng = parseFloat(req.query.lng as string);
  if (isNaN(lat) || isNaN(lng)) {
    res.status(400).json({ error: 'lat and lng query params required' });
    return;
  }

  const radius = Math.min(parseInt(req.query.radius as string) || 25000, 50000);

  const query = `[out:json][timeout:15];(node["shop"="supermarket"](around:${radius},${lat},${lng});way["shop"="supermarket"](around:${radius},${lat},${lng});node["shop"="greengrocer"](around:${radius},${lat},${lng});way["shop"="greengrocer"](around:${radius},${lat},${lng});node["shop"="farm"](around:${radius},${lat},${lng});node["amenity"="marketplace"](around:${radius},${lat},${lng});way["amenity"="marketplace"](around:${radius},${lat},${lng});node["leisure"="garden"]["garden:type"="community"](around:${radius},${lat},${lng}););out tags;`;

  try {
    let elements: Array<{ tags?: Record<string, string>; lat?: number; lon?: number }> = [];

    for (const url of OVERPASS_URLS) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(15000),
        });
        const contentType = response.headers.get('content-type') ?? '';
        if (!response.ok || !contentType.includes('json')) {
          console.warn(`[nearby] ${url} returned ${response.status} (${contentType}), trying next`);
          continue;
        }
        const data = (await response.json()) as { elements?: typeof elements };
        const parsed = data.elements ?? [];
        if (parsed.length > 0) {
          elements = parsed;
          break;
        }
        console.warn(`[nearby] ${url} returned 0 elements, trying next`);
      } catch (err) {
        console.warn(`[nearby] ${url} failed:`, err);
        continue;
      }
    }

    if (elements.length === 0) {
      // All servers failed or returned no results
    }

    // Dedupe by slug, prefer named entries
    const seen = new Map<string, { name: string; slug: string; type: string }>();
    for (const el of elements) {
      const name = el.tags?.name;
      if (!name) continue;
      const slug = toSlug(name);
      if (!slug) continue;
      const type = el.tags?.shop ?? el.tags?.amenity ?? el.tags?.leisure ?? 'market';
      if (!seen.has(slug)) {
        seen.set(slug, { name, slug, type });
      }
    }

    const markets = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.json(markets);
  } catch (err) {
    console.error('[nearby] Overpass error:', err);
    res.status(502).json({ error: 'Overpass query failed' });
  }
});

// ── Recipe URL fetch proxy ────────────────────────────────────
// Used by the web PWA (5174) which has no server-side fetch capability.
// Accepts a URL, fetches the page, extracts JSON-LD Recipe structured data.

function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex: string) => String.fromCharCode(parseInt(hex, 16)));
}

function parseDuration(iso: string): number | undefined {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return undefined;
  return parseInt(match[1] ?? '0', 10) * 60 + parseInt(match[2] ?? '0', 10);
}

function parseInstructions(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val.map((step: unknown, i: number) => {
      if (typeof step === 'string') return `${i + 1}. ${step}`;
      if (step && typeof step === 'object' && 'text' in step) return `${i + 1}. ${(step as { text: string }).text}`;
      return `${i + 1}. ${JSON.stringify(step)}`;
    }).join('\n');
  }
  return '';
}

function parsePhotoUrl(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) {
    const first = val[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'url' in first) return (first as { url: string }).url;
  }
  if (val && typeof val === 'object' && 'url' in val) return (val as { url: string }).url;
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromLdJson(data: any) {
  if (data['@graph']) {
    const recipe = data['@graph'].find((n: { '@type': string }) => n['@type'] === 'Recipe');
    if (recipe) return extractFromLdJson(recipe);
  }
  return {
    title: typeof data.name === 'string' ? decodeEntities(data.name) : data.name,
    description: typeof data.description === 'string' ? decodeEntities(data.description) : undefined,
    instructions: parseInstructions(data.recipeInstructions),
    servings: typeof data.recipeYield === 'number' ? data.recipeYield : typeof data.recipeYield === 'string' ? parseInt(data.recipeYield, 10) || undefined : undefined,
    prepTime: data.prepTime ? parseDuration(data.prepTime) : undefined,
    cookTime: data.cookTime ? parseDuration(data.cookTime) : undefined,
    tags: [
      ...(Array.isArray(data.keywords) ? data.keywords.map((k: string) => typeof k === 'string' ? decodeEntities(k) : k)
        : typeof data.keywords === 'string' ? decodeEntities(data.keywords).split(',').map((k: string) => k.trim()) : []),
      ...(data.recipeCategory ? [data.recipeCategory].flat().map((c: string) => typeof c === 'string' ? decodeEntities(c) : c) : []),
    ].filter(Boolean),
    photoUrl: parsePhotoUrl(data.image),
    ingredients: Array.isArray(data.recipeIngredient)
      ? data.recipeIngredient.map((line: string) => ({
          ingredientName: typeof line === 'string' ? decodeEntities(line) : line,
          quantity: null, unit: null,
        }))
      : [],
  };
}

app.post('/api/fetch-recipe', express.json(), async (req, res) => {
  const { url } = req.body as { url?: string };
  if (!url) { res.status(400).json({ error: 'url is required' }); return; }

  let html: string;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PantryHostBot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (err) {
    res.status(502).json({ error: `Failed to fetch URL: ${(err as Error).message}` });
    return;
  }

  const ldMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of ldMatches) {
    try {
      const data = JSON.parse(match[1]);
      const type = data['@type'];
      if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe')) || data['@graph']) {
        const parsed = extractFromLdJson(data);
        if (parsed.title) { res.json(parsed); return; }
      }
    } catch { /* continue */ }
  }

  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = decodeEntities((h1Match?.[1] ?? titleTagMatch?.[1] ?? '').trim());

  if (!title) {
    res.status(422).json({ error: 'Could not extract recipe data from this page.' });
    return;
  }

  res.json({ title, ingredients: [] });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[api] Listening on port ${PORT}`);
  startFirehose();
});
