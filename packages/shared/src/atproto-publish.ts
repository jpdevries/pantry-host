/**
 * AT Protocol publish client — turns a Pantry Host recipe or menu
 * into an `exchange.recipe.{recipe,collection}` record and pushes
 * it to the signed-in user's PDS via `com.atproto.repo.createRecord`
 * (or `putRecord` on re-publish).
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
 * way in.
 *
 * Scope for v0.2: recipes + collections. No pantry / cookware /
 * kitchen lexicons, no multi-device sync. See
 * `packages/marketing/ATPROTO-TIER-1.5.md` for the aspirational
 * vision beyond this.
 */

import type {
  BlueskyRecipeRecord,
  BlueskyCollectionRecord,
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
 *  import.meta.env when available (browser bundler) and falls back
 *  to process.env on Rex SSR / Node. */
export function isDryRun(): boolean {
  // Vite (web package)
  try {
    // @ts-expect-error - import.meta.env is a Vite-ism
    const viteFlag = import.meta?.env?.VITE_ATPROTO_PUBLISH_DRY_RUN;
    if (viteFlag !== undefined) return String(viteFlag) !== 'false';
  } catch {
    // import.meta not available (Rex/Node) — fall through
  }
  // Rex / Node
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
    return { uri, cid, dryRun: true, record };
  }

  const res = opts.rkey
    ? await opts.agent.com.atproto.repo.putRecord({
        repo: opts.agent.did,
        collection: LEXICON_RECIPE,
        rkey: opts.rkey,
        record: { ...record, $type: LEXICON_RECIPE },
      })
    : await opts.agent.com.atproto.repo.createRecord({
        repo: opts.agent.did,
        collection: LEXICON_RECIPE,
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
    // Inline publish
    const res = await publishRecipe(r, opts);
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

  const res = opts.rkey
    ? await opts.agent.com.atproto.repo.putRecord({
        repo: opts.agent.did,
        collection: LEXICON_COLLECTION,
        rkey: opts.rkey,
        record: { ...collectionRecord, $type: LEXICON_COLLECTION },
      })
    : await opts.agent.com.atproto.repo.createRecord({
        repo: opts.agent.did,
        collection: LEXICON_COLLECTION,
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
