/**
 * Display-only nutrition facts block for Recipe Detail pages.
 *
 * Pantry Host does not store nutrition data. This component "borrows" it
 * from recipe-api.com on demand, only for recipes whose sourceUrl points
 * back to recipe-api.com. The data flows through the browser once per
 * view, never touches PGlite/Postgres, and is silently hidden if the
 * authoritative source is unreachable or no API key is present.
 *
 * Usage:
 *   <NutritionFacts sourceUrl={recipe.sourceUrl} apiKey={apiKey} />
 *
 * The apiKey prop is sourced per-environment:
 *   - packages/web:  localStorage.getItem('recipe-api-key')
 *   - packages/app:  fetched from owner-gated /api/recipe-api-key route
 *
 * Rendered as a default-collapsed <details> block so nutrition is
 * present-but-inert unless the user explicitly opens it.
 */
import { useState, useEffect, useCallback } from 'react';
import {
  getRecipeAPIRecipe,
  recipeApiIdFromSourceUrl,
  type RecipeAPINutritionPerServing,
} from '../recipe-api';

interface Props {
  sourceUrl: string | null | undefined;
  apiKey: string | null | undefined;
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; nutrition: RecipeAPINutritionPerServing; sources: string[] }
  | { status: 'error'; message: string };

// Subset of nutrients shown in the "primary" block at the top. Everything
// else is tucked into an expanded "More" list to keep the UI scannable.
const PRIMARY: Array<{ key: keyof RecipeAPINutritionPerServing; label: string; unit: string; precision?: number }> = [
  { key: 'calories', label: 'Calories', unit: 'kcal', precision: 0 },
  { key: 'protein_g', label: 'Protein', unit: 'g', precision: 1 },
  { key: 'carbohydrates_g', label: 'Carbs', unit: 'g', precision: 1 },
  { key: 'fat_g', label: 'Fat', unit: 'g', precision: 1 },
  { key: 'fiber_g', label: 'Fiber', unit: 'g', precision: 1 },
  { key: 'sugar_g', label: 'Sugar', unit: 'g', precision: 1 },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg', precision: 0 },
];

const SECONDARY: Array<{ key: keyof RecipeAPINutritionPerServing; label: string; unit: string; precision?: number }> = [
  { key: 'saturated_fat_g', label: 'Saturated fat', unit: 'g', precision: 1 },
  { key: 'trans_fat_g', label: 'Trans fat', unit: 'g', precision: 1 },
  { key: 'monounsaturated_fat_g', label: 'Monounsaturated fat', unit: 'g', precision: 1 },
  { key: 'polyunsaturated_fat_g', label: 'Polyunsaturated fat', unit: 'g', precision: 1 },
  { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg', precision: 0 },
  { key: 'potassium_mg', label: 'Potassium', unit: 'mg', precision: 0 },
  { key: 'calcium_mg', label: 'Calcium', unit: 'mg', precision: 0 },
  { key: 'iron_mg', label: 'Iron', unit: 'mg', precision: 1 },
  { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg', precision: 0 },
  { key: 'phosphorus_mg', label: 'Phosphorus', unit: 'mg', precision: 0 },
  { key: 'zinc_mg', label: 'Zinc', unit: 'mg', precision: 1 },
  { key: 'vitamin_a_mcg', label: 'Vitamin A', unit: 'mcg', precision: 0 },
  { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg', precision: 0 },
  { key: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'mcg', precision: 1 },
  { key: 'vitamin_e_mg', label: 'Vitamin E', unit: 'mg', precision: 1 },
  { key: 'vitamin_k_mcg', label: 'Vitamin K', unit: 'mcg', precision: 0 },
  { key: 'vitamin_b6_mg', label: 'Vitamin B6', unit: 'mg', precision: 1 },
  { key: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'mcg', precision: 1 },
  { key: 'thiamin_mg', label: 'Thiamin', unit: 'mg', precision: 1 },
  { key: 'riboflavin_mg', label: 'Riboflavin', unit: 'mg', precision: 1 },
  { key: 'niacin_mg', label: 'Niacin', unit: 'mg', precision: 1 },
  { key: 'folate_mcg', label: 'Folate', unit: 'mcg', precision: 0 },
  { key: 'caffeine_mg', label: 'Caffeine', unit: 'mg', precision: 0 },
  { key: 'alcohol_g', label: 'Alcohol', unit: 'g', precision: 1 },
];

function fmt(value: number | null, precision = 0): string {
  if (value == null) return '—';
  return value.toFixed(precision);
}

export function NutritionFacts({ sourceUrl, apiKey }: Props) {
  const recipeApiId = recipeApiIdFromSourceUrl(sourceUrl ?? null);
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [hasOpened, setHasOpened] = useState(false);

  const loadNutrition = useCallback(async () => {
    if (!recipeApiId || !apiKey) return;
    setState({ status: 'loading' });
    try {
      const r = await getRecipeAPIRecipe(recipeApiId, apiKey);
      if (!r.nutrition?.per_serving) {
        setState({ status: 'error', message: 'No nutrition data available.' });
        return;
      }
      setState({
        status: 'ready',
        nutrition: r.nutrition.per_serving,
        sources: r.nutrition.sources ?? [],
      });
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('429')) setState({ status: 'error', message: 'Nutrition temporarily unavailable (rate limit).' });
      else if (msg.includes('404')) setState({ status: 'error', message: 'Nutrition data no longer available upstream.' });
      else setState({ status: 'error', message: 'Could not load nutrition data.' });
    }
  }, [recipeApiId, apiKey]);

  useEffect(() => {
    if (hasOpened && state.status === 'idle') {
      loadNutrition();
    }
  }, [hasOpened, state.status, loadNutrition]);

  // Silent degradation: not a recipe-api import, or no key available.
  if (!recipeApiId || !apiKey) return null;

  return (
    <details
      className="mt-8 border-t border-[var(--color-border-card)] pt-6"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setHasOpened(true);
      }}
    >
      <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] select-none hover:text-[var(--color-text-primary)]">
        Nutrition (per serving)
      </summary>

      <div className="mt-4">
        {state.status === 'loading' && (
          <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>
        )}

        {state.status === 'error' && (
          <p className="text-sm text-[var(--color-text-secondary)]">{state.message}</p>
        )}

        {state.status === 'ready' && (
          <>
            <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
              {PRIMARY.map(({ key, label, unit, precision }) => (
                <div key={key as string} className="flex flex-col">
                  <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</dt>
                  <dd className="text-lg tabular-nums">
                    {fmt(state.nutrition[key] as number | null, precision)}
                    <span className="text-xs text-[var(--color-text-secondary)] ml-1">{unit}</span>
                  </dd>
                </div>
              ))}
            </dl>

            <details className="mt-5">
              <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] select-none hover:text-[var(--color-text-primary)]">
                More
              </summary>
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 mt-3">
                {SECONDARY.map(({ key, label, unit, precision }) => {
                  const value = state.nutrition[key] as number | null;
                  if (value == null) return null;
                  return (
                    <div key={key as string} className="flex justify-between text-sm">
                      <dt className="text-[var(--color-text-secondary)]">{label}</dt>
                      <dd className="tabular-nums">
                        {fmt(value, precision)} <span className="text-xs text-[var(--color-text-secondary)]">{unit}</span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </details>

            <p className="text-xs text-[var(--color-text-secondary)] mt-5 pretty">
              Data provided by{' '}
              <a
                href={`https://recipe-api.com/recipes/${recipeApiId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                recipe-api.com
              </a>
              {state.sources.length > 0 && ` (${state.sources.join(', ')})`}. Not stored by Pantry Host.
            </p>
          </>
        )}
      </div>
    </details>
  );
}
