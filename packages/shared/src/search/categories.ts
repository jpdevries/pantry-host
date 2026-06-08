/**
 * Recipe category filters — the tag-based pill model used by the recipes page
 * and the Omni Search bar. Lifted into shared so both tiers (and the omni
 * fan-out) match the same set. The two recipes pages still keep their own
 * inline copies for now; this is the canonical list to converge on.
 */
export interface RecipeCategoryFilter {
  key: string;
  label: string;
  /** A result matches the filter if any of its tags (case-insensitive) is here. */
  tags: string[];
}

export const RECIPE_CATEGORY_FILTERS: RecipeCategoryFilter[] = [
  // Dietary
  { key: 'gluten-free', label: 'Gluten-Free', tags: ['gluten-free'] },
  { key: 'vegan', label: 'Vegan', tags: ['vegan'] },
  { key: 'vegetarian', label: 'Vegetarian', tags: ['vegetarian', 'vegan'] },
  { key: 'keto', label: 'Keto', tags: ['keto'] },
  // Meal
  { key: 'breakfast', label: 'Breakfast', tags: ['breakfast', 'brunch'] },
  { key: 'lunch', label: 'Lunch', tags: ['lunch'] },
  { key: 'dinner', label: 'Dinner', tags: ['dinner'] },
  { key: 'dessert', label: 'Dessert', tags: ['dessert'] },
  { key: 'snack', label: 'Snack', tags: ['snack'] },
  { key: 'drink', label: 'Drink', tags: ['drink', 'juice', 'milkshake', 'coffee', 'cocktail', 'alcoholic'] },
  // Method
  { key: 'instant-pot', label: 'Instant Pot', tags: ['instant-pot'] },
  { key: 'griddle', label: 'Griddle', tags: ['griddle'] },
  { key: 'no-cook', label: 'No Cook', tags: ['no-cook', 'no-bake'] },
  { key: 'quick', label: 'Quick', tags: ['quick', 'quick-dinner'] },
  // Lifestyle
  { key: 'breastfeeding-safe', label: 'Breastfeeding Safe', tags: ['breastfeeding-safe'] },
  { key: 'baby-food', label: 'Baby Food', tags: ['baby-food', 'first-foods'] },
  { key: 'lactation', label: 'Lactation', tags: ['lactation'] },
  { key: 'sustainable', label: 'Sustainable', tags: ['sustainable', 'local'] },
];

/**
 * True if `tags` satisfies every selected filter key (multi-select AND).
 * An empty selection matches everything.
 */
export function matchesCategories(tags: string[], selectedKeys: string[]): boolean {
  if (selectedKeys.length === 0) return true;
  const lower = tags.map((t) => t.toLowerCase());
  return selectedKeys.every((key) => {
    const f = RECIPE_CATEGORY_FILTERS.find((rf) => rf.key === key);
    if (!f) return true;
    return f.tags.some((t) => lower.includes(t.toLowerCase()));
  });
}
