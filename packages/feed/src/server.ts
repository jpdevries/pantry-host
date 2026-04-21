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
import { lookupPluByName, lookupPluByCode, isPluCode } from './plu';

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

// ── Full record cache (added for /api/recipes aggregation) ──
// Stores the full exchange.recipe.* record body so clients can paginate a
// single server-side feed instead of fanning out to every publisher's PDS.
// On firehose delete we hard-delete the row to mirror the upstream.
db.exec(`
  CREATE TABLE IF NOT EXISTS recipes (
    at_uri TEXT PRIMARY KEY,
    did TEXT NOT NULL,
    collection TEXT NOT NULL,
    rkey TEXT NOT NULL,
    cid TEXT NOT NULL,
    value TEXT NOT NULL,
    name TEXT,
    created_at TEXT NOT NULL,
    indexed_at TEXT DEFAULT (datetime('now'))
  )
`);
db.exec(`CREATE INDEX IF NOT EXISTS recipes_did_idx ON recipes(did)`);
db.exec(`CREATE INDEX IF NOT EXISTS recipes_collection_created_idx ON recipes(collection, created_at DESC, at_uri)`);
db.exec(`CREATE INDEX IF NOT EXISTS recipes_name_idx ON recipes(name)`);

// Add `inactive` column to publishers (idempotent — ignored if already present).
try {
  db.exec(`ALTER TABLE recipe_publishers ADD COLUMN inactive INTEGER DEFAULT 0`);
} catch { /* column already exists */ }

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

// ── Prepared statements for the recipes table ──
const upsertRecipeStmt = db.prepare(`
  INSERT INTO recipes (at_uri, did, collection, rkey, cid, value, name, created_at, indexed_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(at_uri) DO UPDATE SET
    cid = excluded.cid,
    value = excluded.value,
    name = excluded.name,
    created_at = excluded.created_at,
    indexed_at = datetime('now')
`);
const deleteRecipeStmt = db.prepare(`DELETE FROM recipes WHERE at_uri = ?`);
const deleteRecipesByDidStmt = db.prepare(`DELETE FROM recipes WHERE did = ?`);
const setPublisherInactiveStmt = db.prepare(
  `UPDATE recipe_publishers SET inactive = ? WHERE did = ?`,
);
const updatePublisherHandleStmt = db.prepare(
  `UPDATE recipe_publishers SET handle = ?, last_seen = datetime('now') WHERE did = ?`,
);

function savedCursor(): number | undefined {
  const row = getCursor.get() as { seq: number } | undefined;
  return row?.seq;
}

// ── DID → PDS + handle resolution ────────────────────────────
//
// Every XRPC call must land on the author's authoritative PDS, not
// bsky.social. The firehose indexer duplicates the resolver from
// packages/shared/src/atproto-pds.ts (different workspace; different
// bundling target — we avoid the cross-package import).

const TTL_MS = 60 * 60 * 1000;
interface IdentityCacheEntry { pds: string; handle: string; expires: number; }
const identityCache = new Map<string, IdentityCacheEntry>();

const FALLBACK_PDS = 'https://bsky.social';

async function fetchDidDocument(did: string): Promise<{ service?: Array<{ id: string; type: string; serviceEndpoint: string }> } | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
      if (!res.ok) return null;
      return await res.json();
    }
    if (did.startsWith('did:web:')) {
      const rest = did.slice('did:web:'.length);
      const parts = rest.split(':').map(decodeURIComponent);
      const host = parts[0];
      const path = parts.slice(1).join('/');
      const url = path ? `https://${host}/${path}/did.json` : `https://${host}/.well-known/did.json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return await res.json();
    }
    return null;
  } catch { return null; }
}

async function resolveIdentity(did: string): Promise<IdentityCacheEntry> {
  const now = Date.now();
  const cached = identityCache.get(did);
  if (cached && cached.expires > now) return cached;

  const doc = await fetchDidDocument(did);
  const svc = doc?.service?.find((s) => s.id === '#atproto_pds' || s.id.endsWith('#atproto_pds'));
  const pds = (svc?.type === 'AtprotoPersonalDataServer' ? svc.serviceEndpoint.replace(/\/$/, '') : null) || FALLBACK_PDS;

  let handle = did;
  try {
    const res = await fetch(`${pds}/xrpc/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`);
    if (res.ok) handle = ((await res.json()) as { handle?: string }).handle || did;
  } catch {}

  const entry: IdentityCacheEntry = { pds, handle, expires: now + TTL_MS };
  identityCache.set(did, entry);
  return entry;
}

async function resolveHandle(did: string): Promise<string> {
  return (await resolveIdentity(did)).handle;
}

async function resolvePds(did: string): Promise<string> {
  return (await resolveIdentity(did)).pds;
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
    // Only surface events for the collections we care about — the relay
    // doesn't actually filter on the wire, but this skips our handler for
    // everything else and dramatically cuts CPU/DB work.
    filterCollections: [LEXICON_RECIPE, LEXICON_COLLECTION],
    // Accept unverified commits so one bad signature doesn't drop a whole
    // create event. Record data itself is trustless either way — we're not
    // authenticating on behalf of users.
    unauthenticatedCommits: true,
    unauthenticatedHandles: true,
    handleEvent: async (event: any) => {
      eventsProcessed++;

      if (event.event === 'create' || event.event === 'update') {
        const collection = event.collection;
        if (collection === LEXICON_RECIPE || collection === LEXICON_COLLECTION) {
          const handle = await resolveHandle(event.did);
          upsertStmt.run(event.did, handle);

          // Store the full record body so /api/recipes can serve paginated
          // aggregated feeds without the client fanning out to every PDS.
          try {
            const atUri = `at://${event.did}/${collection}/${event.rkey}`;
            const record = event.record as Record<string, unknown> | undefined;
            const cid = event.cid?.toString?.() ?? String(event.cid ?? '');
            if (record && cid) {
              const name = typeof record.name === 'string' ? record.name : null;
              const createdAt = typeof record.createdAt === 'string'
                ? record.createdAt
                : new Date().toISOString();
              upsertRecipeStmt.run(
                atUri,
                event.did,
                collection,
                event.rkey,
                cid,
                JSON.stringify(record),
                name,
                createdAt,
              );
            } else {
              console.warn(`[firehose] create/update without record body: ${atUri}`);
            }
          } catch (err) {
            console.error('[firehose] failed to store record:', err);
          }

          recipesFound++;
          if (recipesFound % 50 === 0) {
            console.log(`[firehose] indexed ${recipesFound} records so far`);
          }
        }
      } else if (event.event === 'delete') {
        const collection = event.collection;
        if (collection === LEXICON_RECIPE || collection === LEXICON_COLLECTION) {
          const atUri = `at://${event.did}/${collection}/${event.rkey}`;
          deleteRecipeStmt.run(atUri);
          decrementStmt.run(event.did);
          console.log(`[firehose] deleted ${atUri}`);
        }
      } else if (event.event === 'identity') {
        // Handle change or did doc update — refresh our stored handle.
        if (event.handle && typeof event.handle === 'string') {
          updatePublisherHandleStmt.run(event.handle, event.did);
          handleCache.set(event.did, event.handle);
          console.log(`[firehose] identity update: ${event.did} -> @${event.handle}`);
        }
      } else if (event.event === 'account') {
        // Takedown/deactivation: hide publisher + remove their records.
        if (event.active === false) {
          setPublisherInactiveStmt.run(1, event.did);
          deleteRecipesByDidStmt.run(event.did);
          console.log(`[firehose] account ${event.status ?? 'inactive'}: ${event.did}`);
        } else if (event.active === true) {
          setPublisherInactiveStmt.run(0, event.did);
          console.log(`[firehose] account reactivated: ${event.did}`);
        }
      }

      // Persist cursor periodically (every 1000 events). The event carries
      // `seq` per @atproto/sync types; older versions exposed `cursor`.
      const seq = event.seq ?? event.cursor;
      if (seq && eventsProcessed % 1000 === 0) {
        setCursorStmt.run(seq);
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

// ── One-time backfill ───────────────────────────────────────
// On first deploy with the new `recipes` table, pull existing records for
// every known publisher. Idempotent: skips DIDs that already have any rows.

const countRecipesByDidStmt = db.prepare(
  `SELECT COUNT(*) as n FROM recipes WHERE did = ?`,
);
const listPublisherDidsStmt = db.prepare(
  `SELECT did FROM recipe_publishers WHERE inactive = 0 OR inactive IS NULL`,
);

async function backfillRecordsForDid(did: string, collection: string) {
  const pds = await resolvePds(did);
  let cursor: string | undefined;
  let fetched = 0;
  do {
    const params = new URLSearchParams({
      repo: did,
      collection,
      limit: '100',
    });
    if (cursor) params.set('cursor', cursor);
    const url = `${pds}/xrpc/com.atproto.repo.listRecords?${params}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn(`[backfill] listRecords failed for ${did}/${collection}: ${res.status}`);
      return fetched;
    }
    const body = (await res.json()) as {
      records?: Array<{ uri: string; cid: string; value: Record<string, unknown> }>;
      cursor?: string;
    };
    for (const r of body.records ?? []) {
      try {
        const atUri = r.uri;
        // Parse rkey from at://did/collection/rkey
        const m = atUri.match(/^at:\/\/[^/]+\/[^/]+\/(.+)$/);
        const rkey = m?.[1] ?? '';
        const name = typeof r.value.name === 'string' ? r.value.name : null;
        const createdAt = typeof r.value.createdAt === 'string'
          ? r.value.createdAt
          : new Date().toISOString();
        upsertRecipeStmt.run(
          atUri, did, collection, rkey, r.cid,
          JSON.stringify(r.value), name, createdAt,
        );
        fetched++;
      } catch (err) {
        console.error(`[backfill] failed to store ${r.uri}:`, err);
      }
    }
    cursor = body.cursor;
  } while (cursor);
  return fetched;
}

async function startBackfill() {
  const dids = (listPublisherDidsStmt.all() as Array<{ did: string }>).map((r) => r.did);
  if (dids.length === 0) {
    console.log('[backfill] no publishers yet — skipping');
    return;
  }
  console.log(`[backfill] checking ${dids.length} publishers for missing records…`);
  let totalFetched = 0;
  let didsProcessed = 0;
  for (const did of dids) {
    const { n } = countRecipesByDidStmt.get(did) as { n: number };
    if (n > 0) continue; // already have records for this DID
    try {
      const recipes = await backfillRecordsForDid(did, LEXICON_RECIPE);
      const collections = await backfillRecordsForDid(did, LEXICON_COLLECTION);
      totalFetched += recipes + collections;
      didsProcessed++;
      if (recipes + collections > 0) {
        console.log(`[backfill] ${did}: ${recipes} recipes + ${collections} collections`);
      }
    } catch (err) {
      console.error(`[backfill] error for ${did}:`, err);
    }
  }
  console.log(`[backfill] done: ${totalFetched} records across ${didsProcessed} publishers`);
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
  `SELECT did, handle, recipe_count FROM recipe_publishers
   WHERE recipe_count > 0 AND (inactive = 0 OR inactive IS NULL)
   ORDER BY recipe_count DESC`,
);

app.get('/api/handles', (_req, res) => {
  const rows = listHandles.all();
  res.setHeader('Cache-Control', 'public, max-age=60');
  res.json(rows);
});

// ── PLU lookup ───────────────────────────────────────────────────
// Static IFPS dataset bundled in the container (plu-codes.json).
// Resolves produce names to PLU candidates. Supports repeated
// `name` query params for batching. Response shape is stable so
// the self-hosted Rex route at `:3000/api/plu` returns the same
// JSON — clients can swap the base URL.

app.get('/api/plu', (req, res) => {
  // Accept ?name=banana&name=apple, ?name=banana alone, or ?code=4011.
  const rawNames = req.query.name;
  const rawCode = typeof req.query.code === 'string' ? req.query.code : undefined;

  if (rawCode) {
    if (!isPluCode(rawCode)) {
      return res.status(400).json({ error: 'code must be a 4- or 5-digit PLU' });
    }
    const hit = lookupPluByCode(rawCode);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.json({ code: rawCode, record: hit?.record ?? null, organic: hit?.organic ?? false });
  }

  // Accept both repeated `?name=a&name=b` (Express array form) and
  // `?name=a,b,c` (comma-delimited fallback). Matches the app route.
  const collected = Array.isArray(rawNames)
    ? rawNames.filter((n): n is string => typeof n === 'string')
    : typeof rawNames === 'string'
    ? [rawNames]
    : [];
  const names = collected
    .flatMap((v) => v.split(','))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (!names.length) {
    return res.status(400).json({ error: 'name or code query param required' });
  }
  const results = names.map((query) => ({ query, candidates: lookupPluByName(query) }));
  // Data is effectively static (annual refresh at most). A day of
  // edge/browser cache is fine; clients that want fresh bytes can
  // busting with a version query param.
  res.setHeader('Cache-Control', 'public, max-age=86400');
  res.json({ results });
});

// ── Aggregated recipes feed ────────────────────────────────────
// Single endpoint returning full record bodies across all publishers so
// clients don't have to fan out to each PDS. Cursor-paginated.

const listRecipesFirstPageStmt = db.prepare(`
  SELECT r.at_uri, r.did, p.handle, r.collection, r.rkey, r.cid, r.value, r.created_at
  FROM recipes r
  JOIN recipe_publishers p ON p.did = r.did
  WHERE r.collection = ?
    AND (p.inactive = 0 OR p.inactive IS NULL)
  ORDER BY r.created_at DESC, r.at_uri DESC
  LIMIT ?
`);

const listRecipesPagedStmt = db.prepare(`
  SELECT r.at_uri, r.did, p.handle, r.collection, r.rkey, r.cid, r.value, r.created_at
  FROM recipes r
  JOIN recipe_publishers p ON p.did = r.did
  WHERE r.collection = ?
    AND (p.inactive = 0 OR p.inactive IS NULL)
    AND (r.created_at < ? OR (r.created_at = ? AND r.at_uri < ?))
  ORDER BY r.created_at DESC, r.at_uri DESC
  LIMIT ?
`);

app.get('/api/recipes', (req, res) => {
  const collection = (req.query.collection as string) || LEXICON_RECIPE;
  const limit = Math.min(Math.max(parseInt((req.query.limit as string) || '50', 10), 1), 100);
  const cursor = req.query.cursor as string | undefined;

  let rows: Array<{ at_uri: string; did: string; handle: string; collection: string; rkey: string; cid: string; value: string; created_at: string }>;
  if (cursor) {
    // Cursor format: "<createdAt>|<atUri>"
    const sep = cursor.indexOf('|');
    if (sep === -1) {
      res.status(400).json({ error: 'invalid cursor' });
      return;
    }
    const cursorTime = cursor.slice(0, sep);
    const cursorUri = cursor.slice(sep + 1);
    rows = listRecipesPagedStmt.all(collection, cursorTime, cursorTime, cursorUri, limit) as typeof rows;
  } else {
    rows = listRecipesFirstPageStmt.all(collection, limit) as typeof rows;
  }

  const recipes = rows.map((r) => ({
    atUri: r.at_uri,
    did: r.did,
    handle: r.handle,
    collection: r.collection,
    rkey: r.rkey,
    cid: r.cid,
    value: JSON.parse(r.value),
    createdAt: r.created_at,
  }));

  const nextCursor = rows.length === limit
    ? `${rows[rows.length - 1].created_at}|${rows[rows.length - 1].at_uri}`
    : null;

  res.setHeader('Cache-Control', 'public, max-age=30');
  res.json({ recipes, cursor: nextCursor });
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
  // Kick off backfill async — don't block firehose startup. Logs progress.
  startBackfill().catch((err) => console.error('[backfill] error:', err));
});
