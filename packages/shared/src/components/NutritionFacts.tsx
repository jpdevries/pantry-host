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
import { useState, useEffect, useCallback, useId } from 'react';
import { Info, CaretRight } from '@phosphor-icons/react';
import { getRecipeAPIRecipe, recipeApiIdFromSourceUrl } from '../recipe-api';
import type { NutritionPerServing } from '../types/nutrition';
import { NutritionGrid } from './NutritionGrid';

interface Props {
  sourceUrl: string | null | undefined;
  apiKey: string | null | undefined;
}

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; nutrition: NutritionPerServing; sources: string[] }
  | { status: 'error'; message: string };

export function NutritionFacts({ sourceUrl, apiKey }: Props) {
  const recipeApiId = recipeApiIdFromSourceUrl(sourceUrl ?? null);
  const [state, setState] = useState<LoadState>({ status: 'idle' });
  const [hasOpened, setHasOpened] = useState(false);
  const summaryId = useId();

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
      className="group mt-8 border-t border-[var(--color-border-card)] pt-6"
      onToggle={(e) => {
        if ((e.currentTarget as HTMLDetailsElement).open) setHasOpened(true);
      }}
    >
      <summary id={summaryId} className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] select-none hover:text-[var(--color-text-primary)] group-open:text-[var(--color-text-primary)] list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-2">
        <CaretRight size={14} weight="bold" aria-hidden className="transition-transform group-open:rotate-90" />
        <span className="inline-flex items-center gap-1">
          <Info size={16} weight="regular" aria-hidden />
          Nutritional Info (per serving)
        </span>
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
            <NutritionGrid nutrition={state.nutrition} />
            <p className="text-xs text-[var(--color-text-secondary)] mt-5 pretty">
              Nutritional Info data provided by{' '}
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
