/**
 * Bluesky / AT Protocol integration.
 *
 * Read-only client for importing recipes and collections from the AT
 * Protocol network. Uses the `exchange.recipe.recipe` and
 * `exchange.recipe.collection` lexicons from recipe.exchange.
 *
 * All reads go through `bsky.social/xrpc/` which serves
 * `access-control-allow-origin: *` — works directly from the browser
 * in both the self-hosted app and the PGlite PWA. No proxy needed.
 *
 * The write/export path (publishing to a user's PDS) requires
 * authentication and is weekend hackathon scope — not in this module.
 */

import { parseIsoDurationMinutes } from './recipe-api';

// ── Constants ────────────────────────────────────────────────────────────

const XRPC_BASE = 'https://bsky.social/xrpc';

const LEXICON_RECIPE = 'exchange.recipe.recipe';
const LEXICON_COLLECTION = 'exchange.recipe.collection';

// ── Types ────────────────────────────────────────────────────────────────

export interface ParsedAtUri {
  repo: string;
  collection: string;
  rkey: string;
}

export interface BlueskyRecipeRecord {
  name: string;
  text?: string;
  ingredients?: string[];
  instructions?: string[];
  prepTime?: string;
  cookTime?: string;
  totalTime?: string;
  recipeYield?: string;
  recipeCategory?: string;
  recipeCuisine?: string;
  keywords?: string[];
  suitableForDiet?: string[];
  attribution?: {
    $type: string;
    license?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface BlueskyCollectionRecord {
  name: string;
  text?: string;
  recipes: Array<{ uri: string; cid: string }>;
  createdAt?: string;
  updatedAt?: string;
}

export interface AtProtoRecord<T = unknown> {
  uri: string;
  cid: string;
  value: T & { $type: string };
}

// ── AT URI parsing ───────────────────────────────────────────────────────

const AT_URI_RE = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/;

export function parseAtUri(uri: string): ParsedAtUri | null {
  const m = uri.trim().match(AT_URI_RE);
  if (!m) return null;
  return { repo: m[1], collection: m[2], rkey: m[3] };
}

export function isRecipeUri(parsed: ParsedAtUri): boolean {
  return parsed.collection === LEXICON_RECIPE;
}

export function isCollectionUri(parsed: ParsedAtUri): boolean {
  return parsed.collection === LEXICON_COLLECTION;
}

// ── XRPC fetch helpers ───────────────────────────────────────────────────

export async function getRecord<T>(
  repo: string,
  collection: string,
  rkey: string,
): Promise<AtProtoRecord<T>> {
  const url = `${XRPC_BASE}/com.atproto.repo.getRecord?repo=${encodeURIComponent(repo)}&collection=${encodeURIComponent(collection)}&rkey=${encodeURIComponent(rkey)}`;
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message ?? `AT Proto getRecord failed (${res.status})`);
  }
  return res.json();
}

export async function listRecords<T>(
  repo: string,
  collection: string,
  limit = 100,
): Promise<AtProtoRecord<T>[]> {
  const records: AtProtoRecord<T>[] = [];
  let cursor: string | undefined;
  // Paginate — bsky.social caps at 100 per page
  do {
    const params = new URLSearchParams({
      repo,
      collection,
      limit: String(Math.min(limit - records.length, 100)),
    });
    if (cursor) params.set('cursor', cursor);
    const url = `${XRPC_BASE}/com.atproto.repo.listRecords?${params}`;
    const res = await fetch(url);
    if (!res.ok) break;
    const body = await res.json();
    const page = (body.records ?? []) as AtProtoRecord<T>[];
    records.push(...page);
    cursor = body.cursor;
  } while (cursor && records.length < limit);
  return records;
}

export async function resolveHandle(handle: string): Promise<string> {
  const clean = handle.replace(/^@/, '');
  const url = `${XRPC_BASE}/com.atproto.identity.resolveHandle?handle=${encodeURIComponent(clean)}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Could not resolve handle @${clean}`);
  }
  const body = await res.json();
  return body.did;
}

// ── Ingredient string parser ─────────────────────────────────────────────
// AT Protocol recipes store flat strings like "2 cups flour, sifted" or
// "1½ lbs chicken". We parse what we can and fall back gracefully.

const UNITS = new Set([
  'cup', 'cups', 'tbsp', 'tablespoon', 'tablespoons', 'tsp', 'teaspoon',
  'teaspoons', 'oz', 'ounce', 'ounces', 'lb', 'lbs', 'pound', 'pounds',
  'g', 'gram', 'grams', 'kg', 'kilogram', 'kilograms', 'ml', 'milliliter',
  'milliliters', 'l', 'liter', 'liters', 'litre', 'litres', 'pinch',
  'dash', 'clove', 'cloves', 'can', 'bunch', 'head', 'slice', 'slices',
  'piece', 'pieces', 'stalk', 'stalks', 'sprig', 'sprigs',
]);

// Match leading number: integer, decimal, fraction, mixed (1½, 1 1/2)
const NUM_RE = /^([\d]+(?:[.,]\d+)?(?:\s*[\u00BC-\u00BE\u2150-\u215E])?|[\u00BC-\u00BE\u2150-\u215E]|[\d]+\s*\/\s*[\d]+|[\d]+\s+[\d]+\s*\/\s*[\d]+)\s*/;

function parseNumber(s: string): number | null {
  if (!s) return null;
  // Unicode fractions
  const fracs: Record<string, number> = {
    '\u00BC': 0.25, '\u00BD': 0.5, '\u00BE': 0.75,
    '\u2153': 1/3, '\u2154': 2/3, '\u2155': 0.2, '\u2156': 0.4,
    '\u2157': 0.6, '\u2158': 0.8, '\u2159': 1/6, '\u215A': 5/6,
    '\u215B': 0.125, '\u215C': 3/8, '\u215D': 5/8, '\u215E': 7/8,
  };
  let cleaned = s.trim();
  // Mixed number with unicode fraction: "1½"
  for (const [char, val] of Object.entries(fracs)) {
    if (cleaned.includes(char)) {
      const before = cleaned.replace(char, '').trim();
      return (before ? parseFloat(before) : 0) + val;
    }
  }
  // Mixed number with slash: "1 1/2"
  const mixedMatch = cleaned.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)$/);
  if (mixedMatch) return parseInt(mixedMatch[1]) + parseInt(mixedMatch[2]) / parseInt(mixedMatch[3]);
  // Simple fraction: "1/2"
  const fracMatch = cleaned.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (fracMatch) return parseInt(fracMatch[1]) / parseInt(fracMatch[2]);
  // Plain number
  const n = parseFloat(cleaned.replace(',', '.'));
  return isNaN(n) ? null : n;
}

export interface ParsedIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
}

export function parseIngredientString(raw: string): ParsedIngredient {
  const s = raw.trim();
  // Skip section headers (## Heading)
  if (s.startsWith('##')) {
    return { ingredientName: s.replace(/^#+\s*/, ''), quantity: null, unit: null };
  }
  const numMatch = s.match(NUM_RE);
  if (!numMatch) {
    return { ingredientName: s, quantity: null, unit: null };
  }
  const quantity = parseNumber(numMatch[1]);
  let rest = s.slice(numMatch[0].length).trim();
  // Check for unit
  let unit: string | null = null;
  // Handle "tablespoon(s)" style and dotted abbreviations
  const unitMatch = rest.match(/^([a-zA-Z.]+)\s*/);
  if (unitMatch && UNITS.has(unitMatch[1].toLowerCase().replace(/\.$/, ''))) {
    unit = unitMatch[1].toLowerCase().replace(/\.$/, '');
    rest = rest.slice(unitMatch[0].length).trim();
  }
  // Strip leading "of " or "( "
  rest = rest.replace(/^\(\s*/, '').replace(/^of\s+/i, '');
  return {
    ingredientName: rest || raw,
    quantity,
    unit,
  };
}

// ── Recipe converter ─────────────────────────────────────────────────────

export interface ParsedRecipe {
  title: string;
  description?: string;
  instructions: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags: string[];
  photoUrl?: string;
  sourceUrl: string;
  ingredients: ParsedIngredient[];
}

function parseServings(yield_: string | undefined): number | undefined {
  if (!yield_) return undefined;
  const m = yield_.match(/(\d+)/);
  return m ? parseInt(m[1]) : undefined;
}

export function blueskyToRecipe(
  record: BlueskyRecipeRecord,
  atUri: string,
  handle?: string,
): ParsedRecipe {
  // Parse ingredients, filtering out section headers but preserving
  // them as [Group] prefixes on the next real ingredient (same pattern
  // as recipe-api group encoding)
  const ingredients: ParsedIngredient[] = [];
  let pendingGroup: string | null = null;
  for (const raw of record.ingredients ?? []) {
    if (raw.trim().startsWith('##')) {
      pendingGroup = raw.trim().replace(/^#+\s*/, '');
      continue;
    }
    const parsed = parseIngredientString(raw);
    if (pendingGroup) {
      parsed.ingredientName = `[${pendingGroup}] ${parsed.ingredientName}`;
      pendingGroup = null;
    }
    ingredients.push(parsed);
  }

  // Instructions: filter out section headers, number the steps
  const steps = (record.instructions ?? [])
    .filter((s) => !s.trim().startsWith('##'))
    .map((s, i) => `${i + 1}. ${s}`);

  const tags = Array.from(new Set([
    ...(record.keywords ?? []),
    record.recipeCategory,
    record.recipeCuisine,
    ...(record.suitableForDiet ?? []),
    'bluesky',
  ].filter((t): t is string => Boolean(t))));

  const handleStr = handle ? `@${handle.replace(/^@/, '')}` : undefined;
  const attribution = handleStr ? `Shared by ${handleStr} on Bluesky` : undefined;
  const description = [record.text, attribution].filter(Boolean).join('\n\n');

  return {
    title: record.name,
    description: description || undefined,
    instructions: steps.join('\n'),
    servings: parseServings(record.recipeYield),
    prepTime: parseIsoDurationMinutes(record.prepTime) || undefined,
    cookTime: parseIsoDurationMinutes(record.cookTime) || undefined,
    tags,
    sourceUrl: atUri,
    ingredients,
  };
}

// ── High-level import helpers ────────────────────────────────────────────

/** Fetch a single recipe by AT URI and convert to ParsedRecipe. */
export async function fetchBlueskyRecipe(atUri: string): Promise<ParsedRecipe> {
  const parsed = parseAtUri(atUri);
  if (!parsed || !isRecipeUri(parsed)) {
    throw new Error('Not a valid exchange.recipe.recipe AT URI');
  }
  const record = await getRecord<BlueskyRecipeRecord>(parsed.repo, parsed.collection, parsed.rkey);
  // Try to resolve DID → handle for attribution
  let handle: string | undefined;
  try {
    // If repo is a DID, resolve to handle
    if (parsed.repo.startsWith('did:')) {
      const url = `${XRPC_BASE}/com.atproto.repo.describeRepo?repo=${encodeURIComponent(parsed.repo)}`;
      const res = await fetch(url);
      if (res.ok) {
        const body = await res.json();
        handle = body.handle;
      }
    } else {
      handle = parsed.repo; // Already a handle
    }
  } catch { /* attribution is best-effort */ }
  return blueskyToRecipe(record.value as BlueskyRecipeRecord, atUri, handle);
}

/** Fetch a collection and return its metadata + recipe URIs. */
export async function fetchBlueskyCollection(atUri: string): Promise<{
  name: string;
  description: string | null;
  recipeUris: string[];
}> {
  const parsed = parseAtUri(atUri);
  if (!parsed || !isCollectionUri(parsed)) {
    throw new Error('Not a valid exchange.recipe.collection AT URI');
  }
  const record = await getRecord<BlueskyCollectionRecord>(parsed.repo, parsed.collection, parsed.rkey);
  const val = record.value as BlueskyCollectionRecord;
  return {
    name: val.name,
    description: val.text ?? null,
    recipeUris: val.recipes.map((r) => r.uri),
  };
}

/** List all recipes published by a handle or DID. */
export async function listBlueskyRecipes(handleOrDid: string): Promise<{
  handle: string;
  recipes: Array<{ atUri: string; recipe: ParsedRecipe }>;
}> {
  let did = handleOrDid;
  let handle = handleOrDid;
  if (!handleOrDid.startsWith('did:')) {
    did = await resolveHandle(handleOrDid);
    handle = handleOrDid.replace(/^@/, '');
  } else {
    try {
      const url = `${XRPC_BASE}/com.atproto.repo.describeRepo?repo=${encodeURIComponent(did)}`;
      const res = await fetch(url);
      if (res.ok) handle = (await res.json()).handle;
    } catch { /* best-effort */ }
  }
  const records = await listRecords<BlueskyRecipeRecord>(did, LEXICON_RECIPE);
  return {
    handle,
    recipes: records.map((r) => ({
      atUri: r.uri,
      recipe: blueskyToRecipe(r.value as BlueskyRecipeRecord, r.uri, handle),
    })),
  };
}
