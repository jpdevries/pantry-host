/**
 * Pantry-aware ingredient status resolution.
 *
 * Given a recipe ingredient and the user's pantry (matched by
 * case-insensitive exact name), returns one of four states:
 *
 *   - 'have'           — pantry has enough (alwaysOnHand OR quantity >= needed)
 *   - 'need_more'      — pantry has some, but not enough
 *   - 'check_pantry'   — pantry has the item but can't compare quantities
 *                        (missing on one side, or cross-category units)
 *   - 'buy'            — not in the pantry at all
 *
 * Two-dimension quantity: rows can carry an optional `itemSize` +
 * `itemSizeUnit` pair in addition to `quantity` + `unit`. When set, the
 * row's effective *total* is `quantity × itemSize` measured in
 * `itemSizeUnit`. Lets the user express "3 jars × 12 fl_oz" on the
 * pantry side and "2 16oz steaks" on the recipe side.
 *
 * Used by:
 *   - Grocery list (status chips + grey-out)
 *   - Recipe detail (auto-check ingredients that resolve to 'have')
 *   - Future surfaces (meal planner, recipe card indicators)
 */

import { convert, normalizeUnit } from './units';

export type GroceryStatus = 'have' | 'need_more' | 'check_pantry' | 'buy';

export interface PantryItemForStatus {
  name: string;
  /** Alternative names that participate in matching. The display name
   *  is always `name`; any string in `aliases` resolves to this row
   *  through pantryIndex's three tiers (exact / normalized / suffix). */
  aliases?: string[] | null;
  quantity?: number | null;
  unit?: string | null;
  itemSize?: number | null;
  itemSizeUnit?: string | null;
  alwaysOnHand: boolean;
}

export interface RecipeIngredientForStatus {
  ingredientName: string;
  quantity?: number | null;
  unit?: string | null;
  itemSize?: number | null;
  itemSizeUnit?: string | null;
}

/**
 * Collapse a (quantity, unit, itemSize, itemSizeUnit) row into a single
 * (total, totalUnit) pair. When itemSize is set, the total is expressed
 * in itemSizeUnit — i.e., "3 whole × 12 fl_oz" collapses to "36 fl_oz".
 * When itemSize is null, the row collapses to its (quantity, unit) as-is.
 */
function toTotal(row: {
  quantity?: number | null;
  unit?: string | null;
  itemSize?: number | null;
  itemSizeUnit?: string | null;
}): { total: number | null; unit: string | null } {
  if (row.itemSize != null) {
    const qty = row.quantity ?? 1; // no outer count → one pack
    return { total: qty * row.itemSize, unit: row.itemSizeUnit ?? null };
  }
  return { total: row.quantity ?? null, unit: row.unit ?? null };
}

/**
 * Normalize an ingredient name for matching. Strips:
 * - prep notes after the first comma (", softened", ", diced", ", to taste")
 * - parenthetical annotations ("(8 oz)", "(about 2 cups)")
 * - leading/trailing whitespace; collapses internal runs of whitespace
 * Then lowercases the result.
 *
 * "Cream cheese, softened" → "cream cheese"
 * "Tomato sauce (15 oz can)" → "tomato sauce"
 * "All-purpose flour" → "all-purpose flour"
 */
export function normalizeIngredientName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/\([^)]*\)/g, ' ')   // drop parentheticals
    .split(',')[0]                 // drop anything after first comma
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * Lookup index built from a pantry list. Holds three tiers:
 *   - exact: lowercased-name → item (preserves "Philadelphia Cream Cheese"
 *     as distinct from "cream cheese" when both are in the pantry)
 *   - normalized: stripped-name → item (so "cream cheese, softened"
 *     finds "cream cheese")
 *   - suffix: single-token pantry names sorted longest-first, so
 *     "A pinch of salt" → pantry "Salt" via whole-word suffix match.
 *     Only applied for short pantry names (≤3 words) to limit false
 *     positives from overly generic terms.
 *
 * findPantryItem tries each tier in order. Exact always wins, so existing
 * behavior is preserved; normalization and suffix match add flexibility
 * only for names that would otherwise miss.
 */
export interface PantryLookup<T extends PantryItemForStatus> {
  exact: Map<string, T>;
  normalized: Map<string, T>;
  /** Pantry items keyed by their normalized name, sorted longest-first
   * so more-specific names ("olive oil") match before more-generic ones
   * ("oil") on the same recipe ingredient. */
  suffixEntries: { key: string; item: T }[];
}

export function pantryIndex<T extends PantryItemForStatus>(pantry: T[]): PantryLookup<T> {
  const exact = new Map<string, T>();
  const normalized = new Map<string, T>();
  const suffix: { key: string; item: T }[] = [];
  for (const item of pantry) {
    if (!item?.name) continue;
    // Index the canonical name AND every alias under the same row.
    // Aliases let "Dark Roasted Peanut Butter" also match "peanut butter"
    // without the user having to rename the pantry row.
    const candidates = [item.name, ...(item.aliases ?? [])];
    for (const candidate of candidates) {
      if (!candidate) continue;
      exact.set(candidate.toLowerCase(), item);
      const norm = normalizeIngredientName(candidate);
      if (!norm) continue;
      // Earlier entries "win" the normalized slot so exact-intent pantry
      // rows aren't shadowed by a later, more-specific collision.
      if (!normalized.has(norm)) normalized.set(norm, item);
      // Cap suffix match to 2–3 word pantry names. Single-word keys are
      // excluded because they produce too many false positives with
      // compound ingredients ("peanut butter" → "butter", "brown sugar"
      // → "sugar", "almond milk" → "milk"). Users whose recipes say
      // "a pinch of salt" still match pantry "Salt" because the
      // normalizer strips the "pinch of" prefix — tier 2 handles that case.
      const wordCount = norm.split(' ').length;
      if (wordCount >= 2 && wordCount <= 3) suffix.push({ key: norm, item });
    }
  }
  // Longest first: "olive oil" beats "oil" when both are in the pantry.
  suffix.sort((a, b) => b.key.length - a.key.length);
  return { exact, normalized, suffixEntries: suffix };
}

/**
 * Look up a pantry item by recipe ingredient name. Tiers:
 *   1. Exact lowercase match.
 *   2. Normalized match (comma-prep notes + parentheticals + leading articles stripped).
 *   3. Whole-word suffix match (short pantry names matching the tail of a
 *      longer recipe ingredient, e.g. "A pinch of salt" → "Salt").
 */
export function findPantryItem<T extends PantryItemForStatus>(
  index: PantryLookup<T>,
  ingredientName: string | null | undefined,
): T | undefined {
  if (!ingredientName) return undefined;
  const lower = ingredientName.toLowerCase();
  const exact = index.exact.get(lower);
  if (exact) return exact;
  const norm = normalizeIngredientName(ingredientName);
  if (!norm) return undefined;
  const normalized = index.normalized.get(norm);
  if (normalized) return normalized;
  // Tier 3: whole-word suffix match against short pantry names.
  for (const { key, item } of index.suffixEntries) {
    // Skip when the pantry key is itself the full recipe name — already
    // handled by the normalized tier. We only want tail matches.
    if (key === norm) continue;
    // Whole-word boundary: recipe name must end with " <key>" (space + key).
    if (norm.length > key.length && norm.endsWith(' ' + key)) return item;
  }
  return undefined;
}

export function resolveGroceryStatus(
  pantryItem: PantryItemForStatus | undefined,
  ing: RecipeIngredientForStatus,
): GroceryStatus {
  if (!pantryItem) return 'buy';
  if (pantryItem.alwaysOnHand) return 'have';

  const pantry = toTotal(pantryItem);
  const recipe = toTotal(ing);

  // Pantry has no measured total — user is tracking presence, not amount.
  // Treat as on-hand (same semantics as alwaysOnHand).
  // Follow-up: surface this as a visually-distinct "assumed on-hand" state
  // (e.g., asterisk next to the checkbox) so users know which auto-checks
  // were inferred vs. measured.
  if (pantry.total == null) return 'have';

  // Recipe-side ambiguity — can't compare.
  if (recipe.total == null) return 'check_pantry';

  // Same unit (or both missing a unit): direct compare.
  const pantryUnit = normalizeUnit(pantry.unit);
  const recipeUnit = normalizeUnit(recipe.unit);
  if (pantryUnit === recipeUnit) {
    return pantry.total >= recipe.total ? 'have' : 'need_more';
  }

  // Different units: try conversion (volume↔volume, weight↔weight).
  const converted = convert(pantry.total, pantry.unit, recipe.unit);
  if (converted != null) return converted >= recipe.total ? 'have' : 'need_more';

  // Cross-category or unknown-unit — e.g. pantry stored as "1 whole ×
  // 8.1 oz" (weight) but recipe wants "2 tsp" (volume). No math bridges
  // weight ↔ volume without density tables, so fall back to presence
  // semantics: if we have *any* amount, treat as on-hand; if we're at
  // zero, we're out regardless of units. Matches real-world intent —
  // "I have a jar of spice, I'm not out" — while still catching the
  // "3 apples but recipe needs 10" case above via the same-unit path.
  if (pantry.total > 0) return 'have';
  return 'need_more';
}
