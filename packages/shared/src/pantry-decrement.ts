/**
 * Plan the pantry decrement for cooking a recipe.
 *
 * Pure: takes the recipe lines and the kitchen's pantry, returns one
 * `PantryChange` per recipe line saying what would happen to the matching
 * pantry row. Nothing is written here; the GraphQL `cookRecipe` mutation
 * (TS app, TS web, and the Rust port in `packages/server/src/pantry_decrement.rs`)
 * applies the `decremented` rows unless `dryRun` is set, and the UI shows
 * the same plan as a preview before committing.
 *
 * Matching reuses the grocery-list index (exact → normalized → suffix, with
 * aliases), so a line decrements the same row the grocery list would mark
 * as "have". Quantities go through the two-dimension total model: a pantry
 * row of "3 jars × 12 fl oz" is 36 fl oz, so "2 cups" subtracts 16 fl oz
 * and leaves 1.667 jars.
 */

import { convert, normalizeUnit } from './units';
import { findPantryItem, pantryIndex, toTotal } from './grocery-status';

export interface PantryRowForDecrement {
  id: string;
  name: string;
  aliases?: string[] | null;
  quantity?: number | null;
  unit?: string | null;
  itemSize?: number | null;
  itemSizeUnit?: string | null;
  alwaysOnHand: boolean;
}

export interface RecipeLineForDecrement {
  ingredientName: string;
  quantity?: number | null;
  unit?: string | null;
  itemSize?: number | null;
  itemSizeUnit?: string | null;
}

/**
 * Why a line did or didn't change a pantry row:
 *   - `decremented`     — `after` is the new pantry quantity to write.
 *   - `unmatched`       — no pantry row answers to this ingredient name.
 *   - `always_on_hand`  — matched a row whose quantity isn't tracked.
 *   - `untracked`       — matched a row with no quantity (presence only).
 *   - `no_quantity`     — the recipe line has no amount to subtract.
 *   - `unconvertible`   — amounts exist but the units don't bridge
 *                         (volume vs weight, or an unknown unit).
 */
export type PantryChangeStatus =
  | 'decremented'
  | 'unmatched'
  | 'always_on_hand'
  | 'untracked'
  | 'no_quantity'
  | 'unconvertible';

export interface PantryChange {
  recipeIngredient: string;
  ingredientId: string | null;
  pantryName: string | null;
  before: number | null;
  after: number | null;
  /** The pantry row's own unit; `before` and `after` are in it. */
  unit: string | null;
  status: PantryChangeStatus;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function planPantryDecrement(args: {
  recipeServings?: number | null;
  servings?: number | null;
  lines: RecipeLineForDecrement[];
  pantry: PantryRowForDecrement[];
}): PantryChange[] {
  const { lines, pantry } = args;
  const scale =
    args.servings != null && args.servings > 0 && args.recipeServings != null && args.recipeServings > 0
      ? args.servings / args.recipeServings
      : 1;
  const index = pantryIndex(pantry);
  // Two lines can hit the same row ("garlic" and "garlic cloves"); the
  // second subtracts from the first's result, not the stored quantity.
  const running = new Map<string, number | null>();

  return lines.map((line): PantryChange => {
    const item = findPantryItem(index, line.ingredientName);
    const base = {
      recipeIngredient: line.ingredientName,
      ingredientId: item?.id ?? null,
      pantryName: item?.name ?? null,
      unit: item?.unit ?? null,
    };
    if (!item) return { ...base, before: null, after: null, status: 'unmatched' };
    if (item.alwaysOnHand) return { ...base, before: null, after: null, status: 'always_on_hand' };
    const current = running.has(item.id) ? running.get(item.id)! : (item.quantity ?? null);
    if (current == null) return { ...base, before: null, after: null, status: 'untracked' };
    if (line.quantity == null) return { ...base, before: current, after: current, status: 'no_quantity' };

    const pantryTotal = toTotal({ ...item, quantity: current });
    const recipeTotal = toTotal(line);
    if (pantryTotal.total == null || recipeTotal.total == null) {
      return { ...base, before: current, after: current, status: 'no_quantity' };
    }
    const need = recipeTotal.total * scale;
    let delta: number | null;
    if (normalizeUnit(pantryTotal.unit) === normalizeUnit(recipeTotal.unit)) {
      delta = need;
    } else {
      delta = convert(need, recipeTotal.unit, pantryTotal.unit);
    }
    if (delta == null) return { ...base, before: current, after: current, status: 'unconvertible' };

    const newTotal = Math.max(0, pantryTotal.total - delta);
    const after = round3(item.itemSize != null ? newTotal / item.itemSize : newTotal);
    running.set(item.id, after);
    return { ...base, before: current, after, status: 'decremented' };
  });
}
