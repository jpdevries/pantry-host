/**
 * Allergen warning chips for a recipe. Sources unioned and deduped:
 *   1. `contains-*` recipe tags (user-asserted)
 *   2. `allergens_tags` from each ingredient's pantry-side OFF metadata
 *
 * Renders a row of amber chips using the same `--color-warning` token as
 * the `breastfeeding-alert` chip on the recipe detail page. Hidden when
 * there are no allergens to surface — consistent with the silent-hide
 * policy elsewhere on the page.
 */
import { useMemo } from 'react';
import { Warning } from '@phosphor-icons/react';
import { pantryIndex } from '../grocery-status';
import {
  aggregateAllergens,
  type RecipeIngredientForNutrition,
  type PantryItemForNutrition,
} from '../nutrition-aggregate';

interface Props {
  ingredients: RecipeIngredientForNutrition[];
  pantry: PantryItemForNutrition[];
  /** Recipe tags — `contains-*` get folded into the chip set. */
  recipeTags?: readonly string[];
}

/** Title-case for display. "tree nuts" → "Tree Nuts". */
function toTitle(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AllergensLine({ ingredients, pantry, recipeTags }: Props) {
  const allergens = useMemo(() => {
    const lookup = pantryIndex(pantry);
    return aggregateAllergens({ ingredients, lookup, recipeTags });
  }, [ingredients, pantry, recipeTags]);

  if (allergens.length === 0) return null;
  return (
    <div
      className="flex flex-wrap items-center gap-2 mt-6"
      aria-label="Allergens — based on recipe tags and pantry metadata"
    >
      <span className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Contains:
      </span>
      {allergens.map((substance) => (
        <span
          key={substance}
          className="tag inline-flex items-center gap-1"
          style={{ color: 'var(--color-warning)' }}
          title={`Contains ${substance}`}
        >
          <Warning size={12} aria-hidden weight="bold" />
          {toTitle(substance)}
        </span>
      ))}
    </div>
  );
}
