/**
 * Pantry-sourced nutrition panel. Renders when:
 *   - at least one recipe ingredient has a pantry match with OFF
 *     nutriments, AND
 *   - its recipe-side qty is convertible to grams (directly or via
 *     itemSize).
 *
 * The numbers are estimates — the panel makes that explicit via:
 *   - "Estimated Nutrition (per serving)" headline
 *   - coverage line listing missing ingredients with reasons
 *   - "≈" prefix on each primary value (handled by NutritionGrid)
 *   - Open Food Facts attribution + "not a substitute" caveat
 */
import { useMemo, useId } from 'react';
import { Info, CaretRight } from '@phosphor-icons/react';
import { NutritionGrid } from './NutritionGrid';
import {
  aggregateNutrition,
  missingReasonText,
  type RecipeIngredientForNutrition,
  type PantryItemForNutrition,
} from '../nutrition-aggregate';
import { pantryIndex } from '../grocery-status';

interface Props {
  ingredients: RecipeIngredientForNutrition[];
  pantry: PantryItemForNutrition[];
  servings: number | null;
}

const MAX_MISSING_SHOWN = 4;

export function PantryNutritionFacts({ ingredients, pantry, servings }: Props) {
  const summaryId = useId();
  const coverageId = useId();

  const result = useMemo(() => {
    const lookup = pantryIndex(pantry);
    return aggregateNutrition({ ingredients, lookup, servings });
  }, [ingredients, pantry, servings]);

  // Nothing contributed → no panel. Consistent with NutritionFacts's
  // silent-hide policy.
  if (result.contributors.length === 0) return null;

  const coverageN = result.contributors.length;
  const coverageM = result.totalIngredients;
  const visibleMissing = result.missing.slice(0, MAX_MISSING_SHOWN);
  const extraMissing = Math.max(0, result.missing.length - MAX_MISSING_SHOWN);

  return (
    <details className="group mt-8 border-t border-[var(--color-border-card)] pt-6">
      <summary
        id={summaryId}
        aria-describedby={coverageId}
        className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] select-none hover:text-[var(--color-text-primary)] group-open:text-[var(--color-text-primary)] list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-2"
      >
        <CaretRight size={14} weight="bold" aria-hidden className="transition-transform group-open:rotate-90" />
        <span className="inline-flex items-center gap-1">
          <Info size={16} weight="regular" aria-hidden />
          Estimated Nutrition (per serving)
        </span>
      </summary>

      <div className="mt-4">
        <NutritionGrid nutrition={result.nutrition} approximate />

        {/* Coverage + missing list. Always rendered so the caveat is
            visible alongside the numbers. */}
        <p id={coverageId} className="text-xs text-[var(--color-text-secondary)] mt-5 pretty">
          Based on <strong>{coverageN}</strong> of {coverageM} ingredient{coverageM === 1 ? '' : 's'} from your pantry.
          {visibleMissing.length > 0 && (
            <>
              {' '}Missing: {visibleMissing.map((m, i) => (
                <span key={`${m.name}-${i}`}>
                  {i > 0 && ', '}
                  <span className="italic">{m.name}</span>
                  <span> ({missingReasonText(m.reason)})</span>
                </span>
              ))}
              {extraMissing > 0 && <span>, +{extraMissing} more</span>}
              .
            </>
          )}
        </p>

        {/* Attribution. Links each contributor's barcode to its OFF page
            (when available). */}
        <p className="text-xs text-[var(--color-text-secondary)] mt-3 pretty">
          Estimated from{' '}
          <a
            href="https://world.openfoodfacts.org"
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            Open Food Facts
          </a>{' '}
          data on{' '}
          {result.contributors.slice(0, 5).map((c, i) => (
            <span key={`${c.name}-${i}`}>
              {i > 0 && ', '}
              {c.barcode ? (
                <a
                  href={`https://world.openfoodfacts.org/product/${encodeURIComponent(c.barcode)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline"
                >
                  {c.name}
                </a>
              ) : (
                c.name
              )}
            </span>
          ))}
          {result.contributors.length > 5 && <> and {result.contributors.length - 5} more</>}
          . Not a substitute for a nutrition label.
        </p>
      </div>
    </details>
  );
}
