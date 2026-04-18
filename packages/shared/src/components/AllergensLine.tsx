/**
 * Small "Contains: milk, nuts, soy" line aggregated from pantry OFF
 * metadata. Deduplicates allergen tags across every ingredient that
 * matches a pantry row with `allergens_tags`.
 *
 * Renders nothing when no allergens are known — consistent with the
 * silent-hide policy elsewhere on the recipe page. Deliberately
 * understated: nutrition-adjacent, useful, not alarming.
 */
import { useMemo } from 'react';
import { pantryIndex } from '../grocery-status';
import {
  aggregateAllergens,
  type RecipeIngredientForNutrition,
  type PantryItemForNutrition,
} from '../nutrition-aggregate';

interface Props {
  ingredients: RecipeIngredientForNutrition[];
  pantry: PantryItemForNutrition[];
}

/** Title-case first letter of each word; leaves internal casing alone. */
function toTitle(s: string): string {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}

export function AllergensLine({ ingredients, pantry }: Props) {
  const allergens = useMemo(() => {
    const lookup = pantryIndex(pantry);
    return aggregateAllergens({ ingredients, lookup });
  }, [ingredients, pantry]);

  if (allergens.length === 0) return null;
  return (
    <p
      className="text-xs text-[var(--color-text-secondary)] mt-6"
      aria-label="Allergens based on pantry data"
    >
      <span className="font-semibold uppercase tracking-wider">Contains:</span>{' '}
      {allergens.map((a, i) => (
        <span key={a}>
          {i > 0 && ', '}
          {toTitle(a)}
        </span>
      ))}
    </p>
  );
}
