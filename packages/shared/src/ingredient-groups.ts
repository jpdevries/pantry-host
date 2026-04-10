/**
 * Groups a flat ingredient list into sections based on `[Group Name]`
 * prefixes in `ingredientName`.
 *
 * Recipe API imports encode ingredient groups as a `[Group Name] `
 * prefix on the first ingredient of each section (see recipeApiToParsed
 * in recipe-api.ts). This utility parses those prefixes at render time
 * so the detail page can render `<fieldset>` sections with `<legend>`
 * instead of showing raw bracket text inline.
 *
 * Recipes without any `[...]` prefixes produce a single ungrouped
 * section — the detail page renders them as a flat list, unchanged.
 */

export interface IngredientItem {
  /** Original index in the flat array — used to key checkbox state. */
  index: number;
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  sourceRecipeId?: string | null;
}

export interface IngredientGroup {
  /** Group label, or null for ungrouped ingredients. */
  group: string | null;
  items: IngredientItem[];
}

const GROUP_PREFIX_RE = /^\[([^\]]+)\]\s*/;

export function groupIngredients(
  ingredients: { ingredientName: string; quantity: number | null; unit: string | null; sourceRecipeId?: string | null }[],
): IngredientGroup[] {
  const groups: IngredientGroup[] = [];
  let current: IngredientGroup | null = null;

  for (let i = 0; i < ingredients.length; i++) {
    const ing = ingredients[i];
    const match = ing.ingredientName.match(GROUP_PREFIX_RE);

    if (match) {
      // New group starts
      current = { group: match[1], items: [] };
      groups.push(current);
      current.items.push({
        index: i,
        ingredientName: ing.ingredientName.replace(GROUP_PREFIX_RE, ''),
        quantity: ing.quantity,
        unit: ing.unit,
        sourceRecipeId: ing.sourceRecipeId,
      });
    } else if (current) {
      // Continue current group
      current.items.push({
        index: i,
        ingredientName: ing.ingredientName,
        quantity: ing.quantity,
        unit: ing.unit,
        sourceRecipeId: ing.sourceRecipeId,
      });
    } else {
      // Ungrouped — accumulate into a null-group bucket
      if (!groups.length || groups[groups.length - 1].group !== null) {
        groups.push({ group: null, items: [] });
      }
      groups[groups.length - 1].items.push({
        index: i,
        ingredientName: ing.ingredientName,
        quantity: ing.quantity,
        unit: ing.unit,
        sourceRecipeId: ing.sourceRecipeId,
      });
    }
  }

  return groups;
}
