/**
 * Aggregate per-serving nutrition by pulling each recipe ingredient's
 * matching pantry row and summing OFF `nutriments_100g` × grams-used.
 *
 * Coverage is deliberately partial: we only count ingredients whose
 * recipe-side quantity can be converted to grams and whose matched
 * pantry row has `product_meta.nutriments`. Callers render the panel
 * with an "approximate" treatment + a list of missing ingredients so
 * the user understands this isn't a full nutrition label.
 *
 * Pure module — no DOM, no React. Callers wrap in `useMemo`.
 */

import { convert, normalizeUnit } from './units';
import { findPantryItem, type PantryLookup, type PantryItemForStatus } from './grocery-status';
import { emptyNutrition, type NutritionPerServing } from './types/nutrition';
import type { ProductMeta } from './product-meta';

export interface RecipeIngredientForNutrition {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  itemSize?: number | null;
  itemSizeUnit?: string | null;
}

export interface PantryItemForNutrition extends PantryItemForStatus {
  productMeta?: string | null;  // JSON-encoded ProductMeta
  barcode?: string | null;
}

/** Reason an ingredient was excluded from the nutrition sum. Shown in
 *  the coverage line so the user can see why. */
export type MissingReason =
  | 'no-match'         // no matching pantry row
  | 'no-metadata'      // pantry row lacks product_meta / nutriments
  | 'volume-unit'      // can't convert volume to grams without density
  | 'unknown-unit'     // unit we don't recognize
  | 'no-quantity';     // recipe qty missing

export interface MissingIngredient {
  name: string;
  reason: MissingReason;
  qty: number | null;
  unit: string | null;
}

export interface Contributor {
  name: string;
  grams: number;
  barcode: string | null;
}

export interface AggregateResult {
  nutrition: NutritionPerServing;
  contributors: Contributor[];
  missing: MissingIngredient[];
  servings: number;
  /** Total ingredients considered (contributed + missing). */
  totalIngredients: number;
}

/** Weight units recognized by `units.ts`. Keeping a narrow set here so
 *  the caller doesn't need to know about density. */
const WEIGHT_UNITS = new Set(['g', 'kg', 'mg', 'oz', 'lb']);
const VOLUME_UNITS = new Set(['ml', 'l', 'tsp', 'tbsp', 'fl_oz', 'cup', 'pint', 'quart', 'gallon']);

/** Given a recipe ingredient (+ its matched pantry row), return the
 *  weight in grams, or null if we can't compute it. */
export function ingredientToGrams(
  ing: RecipeIngredientForNutrition,
  pantry: PantryItemForNutrition,
): { grams: number } | { grams: null; reason: MissingReason } {
  if (ing.quantity == null) return { grams: null, reason: 'no-quantity' };

  // 1. Recipe side already carries a weight unit.
  const recipeUnit = normalizeUnit(ing.unit);
  if (recipeUnit && WEIGHT_UNITS.has(recipeUnit)) {
    const g = convert(ing.quantity, recipeUnit, 'g');
    if (g != null) return { grams: g };
  }

  // 2. Recipe side uses a volume unit — bail (no density table).
  if (recipeUnit && VOLUME_UNITS.has(recipeUnit)) {
    return { grams: null, reason: 'volume-unit' };
  }

  // 3. Recipe side uses a count unit (or "whole"/"can"/"jar") AND carries
  //    its own itemSize with a weight unit — use recipe-side itemSize.
  const recipeItemUnit = normalizeUnit(ing.itemSizeUnit);
  if (ing.itemSize != null && recipeItemUnit && WEIGHT_UNITS.has(recipeItemUnit)) {
    const total = ing.quantity * ing.itemSize;
    const g = convert(total, recipeItemUnit, 'g');
    if (g != null) return { grams: g };
  }

  // 4. Recipe side has a count unit with no itemSize, but the pantry
  //    row carries an itemSize in weight units — fall back to pantry
  //    side ("1 can tomatoes" + pantry has 14oz can).
  const pantryItemUnit = normalizeUnit(pantry.itemSizeUnit);
  if (pantry.itemSize != null && pantryItemUnit && WEIGHT_UNITS.has(pantryItemUnit)) {
    const total = ing.quantity * pantry.itemSize;
    const g = convert(total, pantryItemUnit, 'g');
    if (g != null) return { grams: g };
  }

  // Unknown territory.
  return { grams: null, reason: recipeUnit ? 'unknown-unit' : 'no-quantity' };
}

/** Map OFF nutriments (per-100g values) into a per-100g-normalized
 *  NutritionPerServing fragment. Caller multiplies by `grams/100` to
 *  compute the ingredient's contribution to the recipe. */
export function offToNutritionPer100g(
  nutriments: ProductMeta['nutriments'] | undefined,
): Partial<NutritionPerServing> {
  if (!nutriments) return {};
  const out: Partial<NutritionPerServing> = {};
  const get = (k: string): number | undefined => {
    const v = nutriments[k];
    return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  };

  const cal = get('energy-kcal_100g');
  if (cal != null) out.calories = cal;
  const p = get('proteins_100g'); if (p != null) out.protein_g = p;
  const c = get('carbohydrates_100g'); if (c != null) out.carbohydrates_g = c;
  const f = get('fat_100g'); if (f != null) out.fat_g = f;
  const sf = get('saturated-fat_100g'); if (sf != null) out.saturated_fat_g = sf;
  const tf = get('trans-fat_100g'); if (tf != null) out.trans_fat_g = tf;
  const mf = get('monounsaturated-fat_100g'); if (mf != null) out.monounsaturated_fat_g = mf;
  const pf = get('polyunsaturated-fat_100g'); if (pf != null) out.polyunsaturated_fat_g = pf;
  const fi = get('fiber_100g'); if (fi != null) out.fiber_g = fi;
  const su = get('sugars_100g'); if (su != null) out.sugar_g = su;
  // OFF sodium is in grams per 100g → convert to mg.
  const so = get('sodium_100g'); if (so != null) out.sodium_mg = so * 1000;
  const ch = get('cholesterol_100g'); if (ch != null) out.cholesterol_mg = ch * 1000;
  const po = get('potassium_100g'); if (po != null) out.potassium_mg = po * 1000;
  const ca = get('calcium_100g'); if (ca != null) out.calcium_mg = ca * 1000;
  const ir = get('iron_100g'); if (ir != null) out.iron_mg = ir * 1000;
  const mg = get('magnesium_100g'); if (mg != null) out.magnesium_mg = mg * 1000;
  const ph = get('phosphorus_100g'); if (ph != null) out.phosphorus_mg = ph * 1000;
  const zn = get('zinc_100g'); if (zn != null) out.zinc_mg = zn * 1000;
  const al = get('alcohol_100g'); if (al != null) out.alcohol_g = al;
  const caf = get('caffeine_100g'); if (caf != null) out.caffeine_mg = caf * 1000;
  // Vitamins (OFF reports in grams/100g, we want mcg or mg).
  const va = get('vitamin-a_100g'); if (va != null) out.vitamin_a_mcg = va * 1_000_000;
  const vc = get('vitamin-c_100g'); if (vc != null) out.vitamin_c_mg = vc * 1000;
  const vd = get('vitamin-d_100g'); if (vd != null) out.vitamin_d_mcg = vd * 1_000_000;
  const ve = get('vitamin-e_100g'); if (ve != null) out.vitamin_e_mg = ve * 1000;
  const vk = get('vitamin-k_100g'); if (vk != null) out.vitamin_k_mcg = vk * 1_000_000;
  const vb6 = get('vitamin-b6_100g'); if (vb6 != null) out.vitamin_b6_mg = vb6 * 1000;
  const vb12 = get('vitamin-b12_100g'); if (vb12 != null) out.vitamin_b12_mcg = vb12 * 1_000_000;
  const th = get('thiamin_100g'); if (th != null) out.thiamin_mg = th * 1000;
  const rb = get('riboflavin_100g'); if (rb != null) out.riboflavin_mg = rb * 1000;
  const ni = get('niacin_100g'); if (ni != null) out.niacin_mg = ni * 1000;
  const fo = get('folate_100g'); if (fo != null) out.folate_mcg = fo * 1_000_000;

  return out;
}

function parseProductMeta(raw: string | null | undefined): ProductMeta | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as ProductMeta) : null;
  } catch {
    return null;
  }
}

/** Sum a per-100g fragment scaled by `grams/100` into the running total. */
function addContribution(
  total: NutritionPerServing,
  per100g: Partial<NutritionPerServing>,
  grams: number,
): void {
  const factor = grams / 100;
  for (const k of Object.keys(per100g) as Array<keyof NutritionPerServing>) {
    const add = per100g[k];
    if (typeof add !== 'number') continue;
    const current = total[k];
    total[k] = ((current ?? 0) + add * factor) as NutritionPerServing[typeof k];
  }
}

/** Divide every non-null value in `total` by `servings`. */
function perServing(total: NutritionPerServing, servings: number): NutritionPerServing {
  if (servings <= 1) return total;
  const out: NutritionPerServing = { ...total };
  for (const k of Object.keys(out) as Array<keyof NutritionPerServing>) {
    const v = out[k];
    if (typeof v === 'number') {
      out[k] = (v / servings) as NutritionPerServing[typeof k];
    }
  }
  return out;
}

interface AggregateInput {
  ingredients: RecipeIngredientForNutrition[];
  lookup: PantryLookup<PantryItemForNutrition>;
  servings: number | null;
}

export function aggregateNutrition(input: AggregateInput): AggregateResult {
  const servings = input.servings && input.servings > 0 ? input.servings : 1;
  const total = emptyNutrition();
  const contributors: Contributor[] = [];
  const missing: MissingIngredient[] = [];

  for (const ing of input.ingredients) {
    const pantry = findPantryItem(input.lookup, ing.ingredientName);
    if (!pantry) {
      missing.push({ name: ing.ingredientName, reason: 'no-match', qty: ing.quantity, unit: ing.unit });
      continue;
    }
    const meta = parseProductMeta(pantry.productMeta);
    const per100g = offToNutritionPer100g(meta?.nutriments);
    if (Object.keys(per100g).length === 0) {
      missing.push({ name: ing.ingredientName, reason: 'no-metadata', qty: ing.quantity, unit: ing.unit });
      continue;
    }
    const g = ingredientToGrams(ing, pantry);
    if (g.grams == null) {
      missing.push({ name: ing.ingredientName, reason: g.reason, qty: ing.quantity, unit: ing.unit });
      continue;
    }
    addContribution(total, per100g, g.grams);
    contributors.push({ name: ing.ingredientName, grams: g.grams, barcode: pantry.barcode ?? null });
  }

  return {
    nutrition: perServing(total, servings),
    contributors,
    missing,
    servings,
    totalIngredients: input.ingredients.length,
  };
}

/** Convenience: collect allergens tags across contributing (and even
 *  non-contributing) pantry-matched ingredients. Returns a deduped
 *  sorted array of human-readable labels (strips the "en:" / "fr:"
 *  prefix). Used for a "Contains: milk, nuts" line on the recipe page. */
export function aggregateAllergens(input: {
  ingredients: RecipeIngredientForNutrition[];
  lookup: PantryLookup<PantryItemForNutrition>;
}): string[] {
  const seen = new Set<string>();
  for (const ing of input.ingredients) {
    const pantry = findPantryItem(input.lookup, ing.ingredientName);
    const meta = parseProductMeta(pantry?.productMeta);
    if (!meta?.allergens_tags) continue;
    for (const tag of meta.allergens_tags) {
      // "en:milk" → "milk"; "fr:soja" → "soja"; no prefix → as-is.
      const m = tag.match(/^[a-z]{2}:(.*)$/);
      const label = (m ? m[1] : tag).replace(/-/g, ' ');
      if (label) seen.add(label);
    }
  }
  return [...seen].sort();
}

/** Render-friendly text for a missing ingredient's reason. */
export function missingReasonText(r: MissingReason): string {
  switch (r) {
    case 'no-match':    return 'not in pantry';
    case 'no-metadata': return 'no nutrition data';
    case 'volume-unit': return 'volume unit';
    case 'unknown-unit': return 'unit not recognized';
    case 'no-quantity': return 'no quantity';
  }
}
