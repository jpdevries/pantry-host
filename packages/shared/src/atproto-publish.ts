/**
 * AT Protocol publish client — turns a Pantry Host recipe or menu
 * into an `exchange.recipe.{recipe,collection}` record and pushes
 * it to the signed-in user's PDS via `com.atproto.repo.putRecord` at
 * a deterministic rkey derived from the local id (`rkeyForLocal`), so
 * publish is idempotent: first publish and every re-publish target
 * one record. Any device can find an already-published record by
 * reading `getRecord(did, collection, rkeyForLocal(id))` — see
 * `findPublishedRecord` — which is how the CTA reflects publish state
 * across devices without a shared database.
 *
 * Dry-run is the default. Set `VITE_ATPROTO_PUBLISH_DRY_RUN=false`
 * (web) or `ATPROTO_PUBLISH_DRY_RUN=false` (app) to actually push
 * records. Every publish also routes through the preview modal in
 * `PublishToBlueskyButton`, so a real publish requires two
 * deliberate acts: editing .env.local and clicking through the
 * modal.
 *
 * Record shape mirrors `BlueskyRecipeRecord` /
 * `BlueskyCollectionRecord` in `bluesky.ts` so the read and write
 * paths round-trip cleanly — import a recipe, edit it, publish it
 * back, import it again; nothing is lost that wasn't lossy on the
 * way in. That includes photos: `photoUrl` is fetched, downscaled
 * to fit the PDS blob cap, uploaded via `uploadBlob`, and attached
 * as `embed.images` — the same field the import path reads.
 * Photo failures (CORS, decode, oversize) log a warning and the
 * publish proceeds without the image; a photo never blocks a
 * publish.
 *
 * Scope for v0.2: recipes + collections. No pantry / cookware /
 * kitchen lexicons, no multi-device sync. See
 * `packages/marketing/ATPROTO-TIER-1.5.md` for the aspirational
 * vision beyond this.
 */

import type {
  BlueskyRecipeRecord,
  BlueskyCollectionRecord,
  BlueskyRecipeImage,
} from './bluesky';
import { getRecord } from './bluesky';
import { minutesToIsoDuration } from './recipe-api';

// ── Types ────────────────────────────────────────────────────────────────

/** The local shape we need to build a record. A subset of both the
 *  app Recipe and web Recipe types so callers can pass whichever
 *  they have. `groceryIngredients` is the recursion-unfurled list
 *  that bubbles sub-recipes into a flat set — matches how we
 *  surface nutrition and allergens today. */
export interface PublishableRecipe {
  id: string;
  title: string;
  description?: string | null;
  instructions: string;
  servings?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  tags?: string[] | null;
  sourceUrl?: string | null;
  photoUrl?: string | null;
  createdAt?: string | null;
  groceryIngredients: Array<{
    ingredientName: string;
    quantity: number | null;
    unit: string | null;
    itemSize?: number | null;
    itemSizeUnit?: string | null;
  }>;
}

/** Local menu shape needed for a collection publish. `recipeRefs`
 *  is what we'll need to resolve per-recipe: each one will either
 *  be reused (already published or imported from Bluesky) or
 *  published inline. */
export interface PublishableMenu {
  id: string;
  title: string;
  description?: string | null;
  createdAt?: string | null;
  recipes: PublishableRecipe[];
}

/** Thin duck-typed handle over `@atproto/api`'s Agent — just what
 *  we actually call. Lets us pass either the real OAuth-backed
 *  agent or a test double. */
export interface PublishAgent {
  did: string;
  com: {
    atproto: {
      repo: {
        createRecord: (input: {
          repo: string;
          collection: string;
          rkey?: string;
          record: unknown;
        }) => Promise<{ data: { uri: string; cid: string } }>;
        putRecord: (input: {
          repo: string;
          collection: string;
          rkey: string;
          record: unknown;
        }) => Promise<{ data: { uri: string; cid: string } }>;
        deleteRecord: (input: {
          repo: string;
          collection: string;
          rkey: string;
        }) => Promise<unknown>;
        uploadBlob: (
          data: Uint8Array,
          opts?: { encoding?: string },
        ) => Promise<{ data: { blob: unknown } }>;
      };
    };
  };
}

export interface PublishOptions {
  agent: PublishAgent;
  /** Handle at the moment of publish (e.g. `jpdevries.bsky.social`) —
   *  baked into the returned receipt so the UI can render
   *  "View on Bluesky" later without re-resolving the DID. */
  handle: string;
  /** Force dry-run regardless of env flag. Useful for tests. */
  dryRun?: boolean;
  /** Override the rkey (used by putRecord on re-publish). */
  rkey?: string;
  /** Resolve a recipe's `photoUrl` to image bytes. Defaults to
   *  `fetchPhotoBlob` (plain `fetch`), which covers the app's
   *  `/uploads/…` paths and CORS-permissive external URLs. The web
   *  PWA passes an OPFS-aware resolver for its `opfs://` photo
   *  scheme. Return null to skip the photo. */
  fetchPhoto?: (photoUrl: string) => Promise<Blob | null>;
}

export interface PublishResult {
  uri: string;
  cid: string;
  dryRun: boolean;
  /** The exact record that was (would have been) sent — useful for
   *  the preview modal and for console logs on dry-run. */
  record: BlueskyRecipeRecord | BlueskyCollectionRecord;
}

// ── Lexicon constants ────────────────────────────────────────────────────

export const LEXICON_RECIPE = 'exchange.recipe.recipe';
export const LEXICON_COLLECTION = 'exchange.recipe.collection';

// Reverse map of the DIET_LABELS reader-side table in bluesky.ts.
// Only tags that appear as keys here become `suitableForDiet[]`
// entries; everything else stays in `keywords[]`.
const DIET_TAG_TO_DEF: Record<string, string> = {
  vegan: 'exchange.recipe.defs#dietVeganDiet',
  vegetarian: 'exchange.recipe.defs#dietVegetarianDiet',
  'gluten-free': 'exchange.recipe.defs#dietGlutenFreeDiet',
  'low-fat': 'exchange.recipe.defs#dietLowFatDiet',
  'low-sodium': 'exchange.recipe.defs#dietLowSodiumDiet',
  'low-calorie': 'exchange.recipe.defs#dietLowCalorieDiet',
  'diabetic-friendly': 'exchange.recipe.defs#dietDiabeticDiet',
  halal: 'exchange.recipe.defs#dietHalalDiet',
  kosher: 'exchange.recipe.defs#dietKosherDiet',
  'dairy-free': 'exchange.recipe.defs#dietDairyFreeDiet',
  'nut-free': 'exchange.recipe.defs#dietNutFreeDiet',
};

// Tags we add automatically on import — stripped back out on publish
// so we don't re-ingest ourselves on the round-trip.
const AUTO_TAG_RE = /^(bluesky|recipe-api|cooklang|mealdb|cocktaildb|publicdomain|wikibooks|imported-from-.*)$/i;

// ── Dry-run detection ────────────────────────────────────────────────────

/** Resolve the effective dry-run flag. Defaults to `true` — a deploy
 *  that doesn't explicitly set the var stays safe. Reads the Vite
 *  import.meta.env when available (web: Vite inlines it), then the
 *  `atproto-publish-dry-run` meta tag (app: Rex doesn't inline
 *  process.env into client bundles, so _document.tsx rides the flag
 *  in on the same meta channel as default-palette), then process.env
 *  (Rex SSR / Node). */
export function isDryRun(): boolean {
  // Vite (web package)
  try {
    // Exact `import.meta.env.VITE_X` token required — Vite's env
    // replacement doesn't recognize optional-chained access; the
    // try/catch covers non-Vite bundlers.
    // @ts-expect-error - import.meta.env is a Vite-ism
    const viteFlag = import.meta.env.VITE_ATPROTO_PUBLISH_DRY_RUN;
    if (viteFlag !== undefined) return String(viteFlag) !== 'false';
  } catch {
    // import.meta not available (Rex/Node) — fall through
  }
  // Rex client (meta tag injected by _document.tsx)
  if (typeof document !== 'undefined') {
    const meta = document
      .querySelector('meta[name="atproto-publish-dry-run"]')
      ?.getAttribute('content');
    if (meta != null) return meta !== 'false';
  }
  // Rex SSR / Node
  if (typeof process !== 'undefined' && process.env) {
    const nodeFlag = process.env.ATPROTO_PUBLISH_DRY_RUN ?? process.env.VITE_ATPROTO_PUBLISH_DRY_RUN;
    if (nodeFlag !== undefined) return String(nodeFlag) !== 'false';
  }
  return true;
}

/** Synthetic rkey / CID pair that makes dry-run receipts recognizable
 *  on sight (the rkey starts with `DRYRUN-`). */
function mintDryRunRef(did: string, collection: string): { uri: string; cid: string; rkey: string } {
  const rand = Math.random().toString(36).slice(2, 12);
  const rkey = `DRYRUN-${rand}`;
  return {
    rkey,
    uri: `at://${did}/${collection}/${rkey}`,
    // `bafyreidryrun` + 46 lowercase alphanumerics mimics a CIDv1
    // long enough to pass most sniff tests while being obviously
    // synthetic.
    cid: `bafyreidryrun${rand.padEnd(46, '0')}`,
  };
}

// ── Photo upload ─────────────────────────────────────────────────────────

/** Stay under the common 1 MB PDS blob cap with headroom for the
 *  multipart envelope. */
const MAX_PHOTO_BYTES = 950_000;
/** Longest edge after downscale — matches the largest variant the
 *  app's own upload pipeline keeps (1200w) plus slack for portrait. */
const MAX_PHOTO_DIM = 1600;

/** Default `fetchPhoto` — plain fetch. Works for the app's
 *  same-origin `/uploads/…` paths, `blob:`/`data:` URLs, and
 *  external URLs whose hosts send CORS headers. Returns null (never
 *  throws) when the URL can't be fetched — a missing photo must not
 *  block a publish. */
export async function fetchPhotoBlob(photoUrl: string): Promise<Blob | null> {
  if (typeof fetch === 'undefined') return null;
  if (photoUrl.startsWith('opfs://')) {
    // Web-PWA scheme — needs the OPFS-aware resolver from the web
    // package (see PublishOptions.fetchPhoto).
    console.warn('[atproto-publish] opfs:// photo needs a fetchPhoto override; skipping', photoUrl);
    return null;
  }
  try {
    const res = await fetch(photoUrl);
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    console.warn('[atproto-publish] photo fetch failed (CORS?); publishing without it', photoUrl);
    return null;
  }
}

/** Decode, downscale to MAX_PHOTO_DIM, and re-encode as JPEG until
 *  the blob fits MAX_PHOTO_BYTES. Small images pass through
 *  untouched (GIFs keep their animation that way). Returns null if
 *  the bytes don't decode as an image. Browser-only — publish
 *  always runs client-side, behind the OAuth session. */
async function prepareImage(
  blob: Blob,
): Promise<{ blob: Blob; width: number; height: number } | null> {
  if (typeof createImageBitmap === 'undefined') return null;
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch {
    return null;
  }
  const { width, height } = bitmap;

  if (blob.size <= MAX_PHOTO_BYTES && Math.max(width, height) <= MAX_PHOTO_DIM) {
    bitmap.close();
    return { blob, width, height };
  }

  const scale = Math.min(1, MAX_PHOTO_DIM / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = new OffscreenCanvas(w, h);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return null;
  }
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  for (const quality of [0.85, 0.7, 0.5]) {
    const out = await canvas.convertToBlob({ type: 'image/jpeg', quality });
    if (out.size <= MAX_PHOTO_BYTES) return { blob: out, width: w, height: h };
  }
  // Pathological image — skip rather than fail the publish.
  return null;
}

/** Fetch + prepare + upload the recipe's photo, returning the
 *  `embed` block for the record — or undefined when there's no
 *  photo or any step fails. `app.bsky.embed.images` is the $type
 *  the Bluesky CDN understands, which is what makes the imported
 *  `${BSKY_CDN}/${did}/${cid}@jpeg` URLs on the read path work. */
async function buildPhotoEmbed(
  recipe: PublishableRecipe,
  opts: PublishOptions,
): Promise<BlueskyRecipeRecord['embed'] | undefined> {
  if (!recipe.photoUrl) return undefined;
  try {
    const fetcher = opts.fetchPhoto ?? fetchPhotoBlob;
    const raw = await fetcher(recipe.photoUrl);
    if (!raw) return undefined;
    const prepared = await prepareImage(raw);
    if (!prepared) return undefined;
    const bytes = new Uint8Array(await prepared.blob.arrayBuffer());
    const res = await opts.agent.com.atproto.repo.uploadBlob(bytes, {
      encoding: prepared.blob.type || 'image/jpeg',
    });
    return {
      $type: 'app.bsky.embed.images',
      images: [
        {
          alt: recipe.title,
          // The live BlobRef instance from @atproto/api serializes to
          // the `{ $type: 'blob', ref: { $link } }` JSON shape that
          // BlueskyRecipeImage describes.
          image: res.data.blob as BlueskyRecipeImage['image'],
          aspectRatio: { width: prepared.width, height: prepared.height },
        },
      ],
    };
  } catch (err) {
    console.warn('[atproto-publish] photo upload failed; publishing without it', err);
    return undefined;
  }
}

// ── Record builders ──────────────────────────────────────────────────────

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1).trimEnd() + '…';
}

function flattenIngredient(ing: PublishableRecipe['groceryIngredients'][number]): string {
  const parts: string[] = [];
  if (ing.quantity != null) {
    // Render integers without the trailing ".0"
    const q = Number.isInteger(ing.quantity) ? String(ing.quantity) : ing.quantity.toFixed(2).replace(/\.?0+$/, '');
    parts.push(q);
  }
  if (ing.unit) parts.push(ing.unit);
  if (ing.itemSize != null && ing.itemSizeUnit) {
    parts.push(`${ing.itemSize}${ing.itemSizeUnit}`);
  }
  parts.push(ing.ingredientName);
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function splitInstructions(raw: string): string[] {
  return raw
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    // Strip leading "1.", "2.", "- " so steps are raw prose
    .map((line) => line.replace(/^(\d+\.\s*|[-*]\s*)/, ''))
    .filter((line) => line.length > 0);
}

function buildAttribution(recipe: PublishableRecipe): BlueskyRecipeRecord['attribution'] | undefined {
  const src = recipe.sourceUrl?.trim();
  if (!src) return undefined;
  if (src.startsWith('at://')) {
    // Another author on ATProto. Use adaptedFrom with the original URI.
    return {
      $type: 'exchange.recipe.defs#adaptedFrom',
      originalUri: src,
    };
  }
  return {
    $type: 'exchange.recipe.defs#adaptedFrom',
    sourceUrl: src,
  };
}

/** Shape a Pantry Host recipe into an `exchange.recipe.recipe`
 *  record. Pure — no network, no localStorage. Exported for the
 *  preview modal so we can render the exact JSON before publish. */
export function buildRecipeRecord(recipe: PublishableRecipe): BlueskyRecipeRecord {
  const now = new Date().toISOString();
  const tags = (recipe.tags ?? []).filter((t) => !AUTO_TAG_RE.test(t));
  const dietDefs: string[] = [];
  const keywords: string[] = [];
  for (const t of tags) {
    const def = DIET_TAG_TO_DEF[t.toLowerCase()];
    if (def) dietDefs.push(def);
    else keywords.push(t);
  }

  const record: BlueskyRecipeRecord = {
    name: truncate(recipe.title, 100),
    createdAt: recipe.createdAt ?? now,
    updatedAt: now,
  };
  if (recipe.description) record.text = truncate(recipe.description, 1000);
  const ingredients = recipe.groceryIngredients.map(flattenIngredient).filter(Boolean);
  if (ingredients.length) record.ingredients = ingredients;
  const instructions = splitInstructions(recipe.instructions);
  if (instructions.length) record.instructions = instructions;
  const prep = minutesToIsoDuration(recipe.prepTime ?? null);
  const cook = minutesToIsoDuration(recipe.cookTime ?? null);
  if (prep) record.prepTime = prep;
  if (cook) record.cookTime = cook;
  if (recipe.servings != null && recipe.servings > 0) {
    record.recipeYield = `${recipe.servings} serving${recipe.servings === 1 ? '' : 's'}`;
  }
  if (keywords.length) record.keywords = keywords;
  if (dietDefs.length) record.suitableForDiet = dietDefs;
  const attribution = buildAttribution(recipe);
  if (attribution) record.attribution = attribution;

  return record;
}

/** Shape a menu + its per-recipe strongRefs into an
 *  `exchange.recipe.collection` record. */
export function buildCollectionRecord(
  menu: PublishableMenu,
  recipeRefs: Array<{ uri: string; cid: string }>,
): BlueskyCollectionRecord {
  const now = new Date().toISOString();
  const record: BlueskyCollectionRecord = {
    name: truncate(menu.title, 100),
    recipes: recipeRefs,
    createdAt: menu.createdAt ?? now,
    updatedAt: now,
  };
  if (menu.description) record.text = truncate(menu.description, 1000);
  return record;
}

// ── Publish actions ──────────────────────────────────────────────────────

/** Push a recipe record to the agent's repo. Honors the dry-run
 *  flag. Returns the AT URI + CID (real or synthetic). */
export async function publishRecipe(
  recipe: PublishableRecipe,
  opts: PublishOptions,
): Promise<PublishResult> {
  const record = buildRecipeRecord(recipe);
  const dry = opts.dryRun ?? isDryRun();

  if (dry) {
    const { uri, cid } = mintDryRunRef(opts.agent.did, LEXICON_RECIPE);
    // eslint-disable-next-line no-console
    console.info('[atproto-publish dry-run] recipe', { uri, cid, record });
    if (recipe.photoUrl) {
      // eslint-disable-next-line no-console
      console.info('[atproto-publish dry-run] would upload photo', recipe.photoUrl);
    }
    return { uri, cid, dryRun: true, record };
  }

  const embed = await buildPhotoEmbed(recipe, opts);
  if (embed) record.embed = embed;

  // Deterministic rkey (from the local id) unless an explicit rkey is
  // given. putRecord creates-or-overwrites, so first publish and every
  // re-publish hit one record — no duplicate on a second device or a
  // cleared cache. `opts.rkey` still wins for records published before
  // this change (their original rkey rides in on the localStorage receipt).
  const rkey = opts.rkey ?? rkeyForLocal(recipe.id);
  const res = await opts.agent.com.atproto.repo.putRecord({
    repo: opts.agent.did,
    collection: LEXICON_RECIPE,
    rkey,
    record: { ...record, $type: LEXICON_RECIPE },
  });
  return { uri: res.data.uri, cid: res.data.cid, dryRun: false, record };
}

/** Publish a collection. Resolves every referenced recipe to a
 *  strongRef first — reusing prior receipts when present,
 *  fetching the CID for Bluesky-imported recipes, and publishing
 *  fresh records otherwise. `recipeRefLookup` is passed in so we
 *  don't couple this module to the localStorage receipt store —
 *  the caller decides which recipes count as "already on my PDS". */
export async function publishCollection(
  menu: PublishableMenu,
  recipeRefLookup: (recipeId: string) => { uri: string; cid: string } | null,
  opts: PublishOptions,
): Promise<{
  recipePublishes: Array<{ recipeId: string; result: PublishResult | null; ref: { uri: string; cid: string } }>;
  collection: PublishResult;
}> {
  const dry = opts.dryRun ?? isDryRun();
  const recipePublishes: Array<{ recipeId: string; result: PublishResult | null; ref: { uri: string; cid: string } }> = [];

  for (const r of menu.recipes) {
    const existing = recipeRefLookup(r.id);
    if (existing) {
      recipePublishes.push({ recipeId: r.id, result: null, ref: existing });
      continue;
    }
    if (r.sourceUrl?.startsWith('at://')) {
      // Upstream Bluesky recipe — reuse as strongRef if we can read
      // its CID. In dry-run we mint a synthetic ref so we don't fire
      // a network read either.
      if (dry) {
        const { uri, cid } = mintDryRunRef(opts.agent.did, LEXICON_RECIPE);
        recipePublishes.push({ recipeId: r.id, result: null, ref: { uri: r.sourceUrl, cid } });
        continue;
      }
      const parts = r.sourceUrl.slice('at://'.length).split('/');
      if (parts.length === 3) {
        try {
          const fetched = await getRecord<unknown>(parts[0], parts[1], parts[2]);
          recipePublishes.push({
            recipeId: r.id,
            result: null,
            ref: { uri: r.sourceUrl, cid: fetched.cid },
          });
          continue;
        } catch {
          // Fall through to inline publish
        }
      }
    }
    // Inline publish — never inherit the menu's rkey (that would write
    // every child to the menu's key). Each child gets its own
    // deterministic rkey keyed to the recipe id.
    const res = await publishRecipe(r, { ...opts, rkey: undefined });
    recipePublishes.push({ recipeId: r.id, result: res, ref: { uri: res.uri, cid: res.cid } });
  }

  const collectionRecord = buildCollectionRecord(
    menu,
    recipePublishes.map((p) => p.ref),
  );

  if (dry) {
    const { uri, cid } = mintDryRunRef(opts.agent.did, LEXICON_COLLECTION);
    // eslint-disable-next-line no-console
    console.info('[atproto-publish dry-run] collection', { uri, cid, record: collectionRecord });
    return {
      recipePublishes,
      collection: { uri, cid, dryRun: true, record: collectionRecord },
    };
  }

  const rkey = opts.rkey ?? rkeyForLocal(menu.id);
  const res = await opts.agent.com.atproto.repo.putRecord({
    repo: opts.agent.did,
    collection: LEXICON_COLLECTION,
    rkey,
    record: { ...collectionRecord, $type: LEXICON_COLLECTION },
  });
  return {
    recipePublishes,
    collection: { uri: res.data.uri, cid: res.data.cid, dryRun: false, record: collectionRecord },
  };
}

/** Remove a previously published record. `atUri` is a full
 *  at://did/collection/rkey. Dry-run is a no-op that returns. */
export async function unpublish(atUri: string, opts: PublishOptions): Promise<{ dryRun: boolean }> {
  const dry = opts.dryRun ?? isDryRun();
  if (dry) {
    // eslint-disable-next-line no-console
    console.info('[atproto-publish dry-run] unpublish', atUri);
    return { dryRun: true };
  }
  const parts = atUri.replace(/^at:\/\//, '').split('/');
  if (parts.length !== 3) throw new Error(`Invalid AT URI: ${atUri}`);
  const [repo, collection, rkey] = parts;
  await opts.agent.com.atproto.repo.deleteRecord({ repo, collection, rkey });
  return { dryRun: false };
}

/** Pull the rkey out of an AT URI. Handy for re-publish flows. */
export function rkeyFromUri(atUri: string): string | null {
  const parts = atUri.replace(/^at:\/\//, '').split('/');
  return parts.length === 3 ? parts[2] : null;
}

/** Deterministic record key derived from a local recipe/menu id.
 *  The same local id always maps to the same rkey on the PDS, so a
 *  first publish and every re-publish target one record — no
 *  duplicates — and any device that knows the local id can find the
 *  published record by reading `getRecord(did, collection, rkey)`
 *  without a stored receipt. Local ids are UUIDs, which are already
 *  valid rkeys; sanitize + length-cap defensively for any other id
 *  scheme (rkey syntax: 1–512 of [A-Za-z0-9._~:-], never "." / ".."). */
export function rkeyForLocal(localId: string): string {
  const safe = localId.replace(/[^A-Za-z0-9._~:-]/g, '-').slice(0, 512);
  return safe === '' || safe === '.' || safe === '..' ? `ph-${safe || 'x'}` : safe;
}

/** Does a record still exist at this AT URI? Public read (no auth).
 *  Used to reconcile a stored receipt against PDS reality — e.g. the
 *  record was deleted from another client. */
export async function recordExists(atUri: string): Promise<boolean> {
  const parts = atUri.replace(/^at:\/\//, '').split('/');
  if (parts.length !== 3) return false;
  try {
    await getRecord<unknown>(parts[0], parts[1], parts[2]);
    return true;
  } catch {
    return false;
  }
}

/** Look up whether a local recipe/menu is already published on a
 *  DID's PDS, by its deterministic rkey. Returns the live
 *  `{ uri, cid }` if present, or null (including on 404). Powers
 *  cross-device CTA state: a second device resolves the same rkey
 *  and adopts the record without ever having a local receipt. */
export async function findPublishedRecord(
  did: string,
  collection: string,
  localId: string,
): Promise<{ uri: string; cid: string } | null> {
  try {
    const rec = await getRecord<unknown>(did, collection, rkeyForLocal(localId));
    return { uri: rec.uri, cid: rec.cid };
  } catch {
    return null;
  }
}
