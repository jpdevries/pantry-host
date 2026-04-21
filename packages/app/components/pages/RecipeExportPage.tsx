import Head from 'next/head';
import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { gql } from '@/lib/gql';
import { recipeBookToDataURI, imageToDataURI } from '@pantry-host/shared/export-recipe';
import type { ExportableRecipe } from '@pantry-host/shared/export-recipe';

interface RecipeListItem {
  id: string;
  slug: string | null;
  title: string;
  tags: string[];
}

interface RecipeDetail {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  instructions: string;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  tags: string[];
  requiredCookware: { id: string; name: string }[];
  source: string;
  sourceUrl: string | null;
  photoUrl: string | null;
  ingredients: { ingredientName: string; quantity: number | null; unit: string | null }[];
}

const LIST_QUERY = `query Recipes($kitchenSlug: String) {
  recipes(kitchenSlug: $kitchenSlug) { id slug title tags }
}`;

const DETAIL_QUERY = `query Recipe($id: String!) {
  recipe(id: $id) {
    id slug title description instructions servings prepTime cookTime
    tags requiredCookware { id name } source sourceUrl photoUrl
    ingredients { ingredientName quantity unit }
  }
}`;

interface Props {
  kitchen: string;
}

export default function RecipeExportPage({ kitchen }: Props) {
  const recipesBase = `/kitchens/${kitchen}/recipes`;
  const kitchenSlug = kitchen;

  const [recipes, setRecipes] = useState<RecipeListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  // Eagerly prefetched recipe details
  const detailCache = useRef<Map<string, ExportableRecipe>>(new Map());
  const fetchingIds = useRef<Set<string>>(new Set());

  useEffect(() => {
    gql<{ recipes: RecipeListItem[] }>(LIST_QUERY, { kitchenSlug })
      .then((d) => {
        const sorted = [...d.recipes].sort((a, b) => a.title.localeCompare(b.title));
        setRecipes(sorted);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [kitchenSlug]);

  // Prefetch recipe detail when selected
  const prefetch = useCallback((id: string) => {
    if (detailCache.current.has(id) || fetchingIds.current.has(id)) return;
    fetchingIds.current.add(id);
    gql<{ recipe: RecipeDetail }>(DETAIL_QUERY, { id })
      .then((d) => {
        if (d.recipe) detailCache.current.set(id, {
          ...d.recipe,
          requiredCookware: d.recipe.requiredCookware.map((c) => c.name),
        } as unknown as ExportableRecipe);
      })
      .catch(() => {})
      .finally(() => fetchingIds.current.delete(id));
  }, []);

  const allSelected = recipes.length > 0 && selected.size === recipes.length;

  function toggleAll() {
    if (allSelected) {
      setSelected(new Set());
    } else {
      const all = new Set(recipes.map((r) => r.id));
      setSelected(all);
      // Prefetch all
      for (const id of all) prefetch(id);
    }
  }

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
      prefetch(id);
    }
    setSelected(next);
  }

  async function handleExport(e: React.FormEvent) {
    e.preventDefault();
    if (selected.size === 0) return;
    setExporting(true);
    try {
      const ids = Array.from(selected);
      // Fetch any that aren't already cached
      const uncached = ids.filter((id) => !detailCache.current.has(id));
      for (let i = 0; i < uncached.length; i += 5) {
        const batch = uncached.slice(i, i + 5);
        const results = await Promise.all(
          batch.map((id) => gql<{ recipe: RecipeDetail }>(DETAIL_QUERY, { id })),
        );
        for (const r of results) {
          if (r.recipe) detailCache.current.set(r.recipe.id, {
            ...r.recipe,
            requiredCookware: r.recipe.requiredCookware.map((c) => c.name),
          } as unknown as ExportableRecipe);
        }
      }
      const details = ids.map((id) => detailCache.current.get(id)).filter(Boolean) as ExportableRecipe[];
      // Resolve local upload photos to data URIs for self-contained export
      const resolvedDetails = await Promise.all(
        details.map(async (r) => {
          if (!r.photoUrl?.startsWith('/uploads/')) return r;
          const uuid = r.photoUrl.replace(/^\/uploads\//, '').replace(/\.\w+$/, '');
          try {
            const dataUri = await imageToDataURI(`/uploads/${uuid}-400.jpg`);
            return { ...r, photoUrl: dataUri };
          } catch {
            return { ...r, photoUrl: null };
          }
        }),
      );
      const uri = recipeBookToDataURI(resolvedDetails);
      // Trigger download immediately
      const a = document.createElement('a');
      a.href = uri;
      a.download = 'pantry-host-recipes.html';
      a.click();
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  const selectedCount = selected.size;

  const exportIcon = (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width={16} height={16} fill="currentColor" aria-hidden="true">
      <path d="M567.31 283.89l-71.78-68.16c-8.28-7.8-20.41-9.88-30.84-5.38-10.31 4.42-16.69 13.98-16.69 24.97V288h-64V131.97c0-12.7-5.1-25-14.1-33.99L286.02 14.1c-9-9-21.2-14.1-33.89-14.1H47.99C21.5.1 0 21.6 0 48.09v415.92C0 490.5 21.5 512 47.99 512h288.02c26.49 0 47.99-21.5 47.99-47.99V352h-31.99v112.01c0 8.8-7.2 16-16 16H47.99c-8.8 0-16-7.2-16-16V48.09c0-8.8 7.2-16.09 16-16.09h176.04v104.07c0 13.3 10.7 23.93 24 23.93h103.98v128H168c-4.42 0-8 3.58-8 8v16c0 4.42 3.58 8 8 8h280v52.67c0 10.98 6.38 20.55 16.69 24.97 14.93 6.45 26.88-1.61 30.88-5.39l71.72-68.12c5.62-5.33 8.72-12.48 8.72-20.12s-3.1-14.81-8.7-20.12zM256.03 128.07V32.59c2.8.7 5.3 2.1 7.4 4.2l83.88 83.88c2.1 2.1 3.5 4.6 4.2 7.4h-95.48zM480 362.88V245.12L542 304l-62 58.88z" />
    </svg>
  );

  const exportBtn = (
    <button
      type="submit"
      disabled={selectedCount === 0}
      className="inline-flex items-center gap-2 btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {exporting ? (
        <>
          <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" aria-hidden />
          Preparing export&hellip;
        </>
      ) : (
        <>Export {selectedCount} {selectedCount === 1 ? 'Recipe' : 'Recipes'} {exportIcon}</>
      )}
    </button>
  );

  // Build tag cloud: tag → count, sorted by count descending
  const tagCloud = useMemo(() => {
    const counts = new Map<string, number>();
    for (const r of recipes) {
      for (const t of r.tags) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]);
  }, [recipes]);

  function selectByTag(tag: string) {
    const nextTags = new Set(activeTags);
    if (nextTags.has(tag)) {
      nextTags.delete(tag);
    } else {
      nextTags.add(tag);
    }
    setActiveTags(nextTags);
    // Rebuild selection from all active tags
    const next = new Set<string>();
    for (const r of recipes) {
      if (r.tags.some((t) => nextTags.has(t))) {
        next.add(r.id);
        prefetch(r.id);
      }
    }
    // Also keep any individually checked recipes
    for (const id of selected) {
      const recipe = recipes.find((r) => r.id === id);
      if (recipe && !recipe.tags.some((t) => activeTags.has(t) && !nextTags.has(t))) {
        next.add(id);
      }
    }
    setSelected(next);
  }

  return (
    <>
      <Head><title>Export Recipes — Pantry Host</title></Head>
      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
        <a href={`${recipesBase}#stage`} className="text-sm text-secondary hover:underline mb-6 inline-block">&larr; Recipes</a>
        <h1 className="text-4xl font-bold mb-4">Export Recipes</h1>

        {tagCloud.length > 0 && (
          <details className="mb-8">
            <summary className="text-sm text-secondary cursor-pointer hover:underline">Select by tag</summary>
            <div className="flex flex-wrap gap-2 mt-3">
              {tagCloud.map(([tag, count]) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => selectByTag(tag)}
                    aria-pressed={activeTags.has(tag)}
                    className="text-xs px-2.5 py-1 rounded-full border-2 transition-colors"
                    style={activeTags.has(tag)
                      ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-bg-body)', borderColor: 'var(--color-accent)', fontWeight: 700 }
                      : { backgroundColor: 'var(--color-accent-subtle)', color: 'var(--color-text-secondary)', borderColor: 'var(--color-border-card)' }
                    }
                  >
                    {tag} <span className="opacity-60">{count}</span>
                  </button>
              ))}
            </div>
          </details>
        )}

        {loading ? (
          <div className="animate-pulse space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-10 bg-[var(--color-accent-subtle)] rounded" />
            ))}
          </div>
        ) : recipes.length === 0 ? (
          <p className="text-secondary">No recipes to export.</p>
        ) : (
          <form onSubmit={handleExport}>
            <fieldset disabled={exporting}>
              <legend className="sr-only">Select recipes to export</legend>

              <div className="flex items-center justify-between mb-4">
                <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    className="accent-[var(--color-accent)]"
                  />
                  <span className="font-medium">{allSelected ? 'Deselect All' : 'Select All'}</span>
                </label>
                <span className="text-sm text-secondary">{selectedCount} of {recipes.length} selected</span>
              </div>

              <div className="mb-4">{exportBtn}</div>

              <div className="border border-[var(--color-border-card)] rounded-lg divide-y divide-[var(--color-border-card)] mb-6">
                {recipes.map((r) => (
                  <label key={r.id} className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:underline">
                    <input
                      type="checkbox"
                      checked={selected.has(r.id)}
                      onChange={() => toggle(r.id)}
                      className="accent-[var(--color-accent)] shrink-0"
                      aria-label={`Export ${r.title}`}
                    />
                    <span className="flex-1 text-sm font-medium">{r.title}</span>
                    {r.tags.length > 0 && (
                      <span className="hidden sm:flex gap-1">
                        {r.tags.slice(0, 3).map((t) => (
                          <span key={t} className="text-xs px-1.5 py-0.5 rounded-full bg-[var(--color-accent-subtle)] text-secondary">{t}</span>
                        ))}
                        {r.tags.length > 3 && <span className="text-xs text-secondary">+{r.tags.length - 3}</span>}
                      </span>
                    )}
                  </label>
                ))}
              </div>

              {exportBtn}
            </fieldset>
          </form>
        )}
      </main>
    </>
  );
}
