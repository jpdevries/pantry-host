/**
 * Allowlisted subset of Open Food Facts product data that Pantry Host
 * is willing to persist on pantry ingredients when the user opts in
 * (STORE_BARCODE_META setting). Intended to enable MCP agents and
 * nutrition-aware tools to reason about pantry items without hoarding
 * PII-ish fields like store lists, country codes, or submitter metadata.
 *
 * Store as JSONB; type is advisory (schema can evolve with OFF without
 * breaking existing rows).
 */

export interface ProductMeta {
  /** Barcode echo (EAN-13, UPC-A, etc.) — kept for provenance. */
  code?: string;
  /** First brand in the OFF comma-separated list. */
  brands?: string;
  /** OFF category taxonomy tags ("en:chocolate-spreads"). */
  categories_tags?: string[];
  /** Free-text ingredients list — useful for LLMs to classify. */
  ingredients_text?: string;
  /** OFF allergen taxonomy tags ("en:milk", "en:nuts"). */
  allergens_tags?: string[];
  /** Human-readable serving string ("15 g", "2 tbsp"). */
  serving_size?: string;
  /** Numeric serving quantity (paired with serving_size). */
  serving_quantity?: number;
  /** Nutri-Score: a (best) through e (worst). */
  nutriscore_grade?: 'a' | 'b' | 'c' | 'd' | 'e';
  /** NOVA food processing score: 1 (unprocessed) through 4 (ultra-processed). */
  nova_group?: 1 | 2 | 3 | 4;
  /** Eco-Score grade (a–e, or "unknown"/"not-applicable"). */
  ecoscore_grade?: string;
  /** OFF label taxonomy tags ("en:vegetarian", "en:no-gluten"). */
  labels_tags?: string[];
  /** Nutrient map — we keep per-100g and per-serving numeric values only. */
  nutriments?: Record<string, number>;
  /** OFF's primary category tag ("en:ice-cream"). Often populated when
   *  `categories_tags` is thin, so kept alongside as a complement rather
   *  than a substitute. */
  main_category?: string;
  /** OFF's nutritional-grouping taxonomy. Two-level hierarchy:
   *    pnns_groups_1 = "Sugary snacks" | "Milk and dairy products" | ...
   *    pnns_groups_2 = "Ice cream" | "Cheese" | ...
   *  Present on many products where `categories_tags` is empty, so
   *  valuable for later re-classification passes even when the value is
   *  "unknown" on a given scan — the shape stays consistent. */
  pnns_groups_1?: string;
  pnns_groups_2?: string;
}

/** OFF keys worth fetching in addition to the existing
 *  product_name/brands/categories_tags/quantity/product_quantity/product_quantity_unit. */
export const OFF_METADATA_FIELDS = [
  'nutriments',
  'ingredients_text',
  'allergens_tags',
  'nutriscore_grade',
  'nova_group',
  'ecoscore_grade',
  'serving_size',
  'serving_quantity',
  'labels_tags',
  'main_category',
  'pnns_groups_1',
  'pnns_groups_2',
  'code',
] as const;

/** Soft cap on stored meta size (JSON.stringify bytes). Anything larger
 *  is dropped — barcode is still kept. Prevents pathological OFF
 *  responses from bloating a row. */
export const PRODUCT_META_MAX_BYTES = 8 * 1024;

/** Safely parse a serialized ProductMeta string. Returns null on
 *  empty input, malformed JSON, or non-object payloads — callers
 *  treat that the same as "no metadata available". */
export function safeParseMeta(raw: string | null | undefined): ProductMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ProductMeta) : null;
  } catch {
    return null;
  }
}

/** Keep only per-100g and per-serving nutriment values (numbers). Drops
 *  _value, _unit, and other modifier clones that OFF duplicates. */
function trimNutriments(n: Record<string, unknown> | undefined): Record<string, number> | undefined {
  if (!n || typeof n !== 'object') return undefined;
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(n)) {
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    if (k.endsWith('_100g') || k.endsWith('_serving')) out[k] = v;
  }
  return Object.keys(out).length ? out : undefined;
}

/** String-array filter — keeps up to `max` non-empty strings. */
function trimStringArray(arr: unknown, max = 32): string[] | undefined {
  if (!Array.isArray(arr)) return undefined;
  const out = arr.filter((x): x is string => typeof x === 'string' && x.length > 0).slice(0, max);
  return out.length ? out : undefined;
}

/** Plain string passthrough with a length cap (OFF ingredients_text can
 *  get long; we truncate rather than reject to keep useful context). */
function trimString(s: unknown, max: number): string | undefined {
  if (typeof s !== 'string' || !s) return undefined;
  return s.length > max ? s.slice(0, max) : s;
}

/** Narrow the full OFF product payload to the allowlisted ProductMeta
 *  shape. Unknown fields are discarded by design. */
export function allowlistProductMeta(raw: Record<string, unknown> | null | undefined): ProductMeta | null {
  if (!raw || typeof raw !== 'object') return null;

  const meta: ProductMeta = {};
  const code = trimString(raw.code, 64);
  if (code) meta.code = code;
  const brands = trimString(raw.brands, 200);
  if (brands) meta.brands = brands.split(',')[0].trim();
  const categories = trimStringArray(raw.categories_tags);
  if (categories) meta.categories_tags = categories;
  const ingredientsText = trimString(raw.ingredients_text, 2000);
  if (ingredientsText) meta.ingredients_text = ingredientsText;
  const allergens = trimStringArray(raw.allergens_tags);
  if (allergens) meta.allergens_tags = allergens;
  const servingSize = trimString(raw.serving_size, 100);
  if (servingSize) meta.serving_size = servingSize;
  if (typeof raw.serving_quantity === 'number' && Number.isFinite(raw.serving_quantity)) {
    meta.serving_quantity = raw.serving_quantity;
  } else if (typeof raw.serving_quantity === 'string') {
    const n = parseFloat(raw.serving_quantity);
    if (Number.isFinite(n)) meta.serving_quantity = n;
  }
  const ns = raw.nutriscore_grade;
  if (typeof ns === 'string' && 'abcde'.includes(ns)) {
    meta.nutriscore_grade = ns as ProductMeta['nutriscore_grade'];
  }
  if (typeof raw.nova_group === 'number' && [1, 2, 3, 4].includes(raw.nova_group)) {
    meta.nova_group = raw.nova_group as 1 | 2 | 3 | 4;
  }
  const eco = trimString(raw.ecoscore_grade, 30);
  if (eco) meta.ecoscore_grade = eco;
  const labels = trimStringArray(raw.labels_tags);
  if (labels) meta.labels_tags = labels;
  const nut = trimNutriments(raw.nutriments as Record<string, unknown> | undefined);
  if (nut) meta.nutriments = nut;
  const mainCategory = trimString(raw.main_category, 200);
  if (mainCategory) meta.main_category = mainCategory;
  const pnns1 = trimString(raw.pnns_groups_1, 100);
  if (pnns1) meta.pnns_groups_1 = pnns1;
  const pnns2 = trimString(raw.pnns_groups_2, 100);
  if (pnns2) meta.pnns_groups_2 = pnns2;

  if (Object.keys(meta).length === 0) return null;

  // Enforce soft cap: if the allowlisted payload is still too big, drop
  // heavy fields in order of least-structural-value.
  const overBudget = () => JSON.stringify(meta).length > PRODUCT_META_MAX_BYTES;
  if (overBudget()) delete meta.ingredients_text;
  if (overBudget()) delete meta.categories_tags;
  if (overBudget()) delete meta.labels_tags;
  if (overBudget()) delete meta.nutriments;
  if (overBudget()) return null;  // give up — barcode alone

  return meta;
}
