import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import {
  searchFederationRecipes,
  getFederationRecipe,
  cooklangToRecipe,
  type FederationSearchResult,
  type FederationPagination,
} from '@pantry-host/shared/cooklang';
import { MagnifyingGlass } from '@phosphor-icons/react';

const CREATE_MUTATION = `mutation(
  $title: String!, $description: String, $instructions: String!,
  $servings: Int, $prepTime: Int, $cookTime: Int,
  $tags: [String!], $photoUrl: String,
  $ingredients: [RecipeIngredientInput!]!
) {
  createRecipe(
    title: $title, description: $description, instructions: $instructions,
    servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
    tags: $tags, photoUrl: $photoUrl, ingredients: $ingredients
  ) { id slug }
}`;

export default function RecipeImportPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FederationSearchResult[]>([]);
  const [pagination, setPagination] = useState<FederationPagination | null>(null);
  const [searching, setSearching] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const search = useCallback(async (q: string, page = 1, append = false) => {
    if (!q.trim()) { setResults([]); setPagination(null); return; }
    if (page === 1) setSearching(true);
    else setLoadingMore(true);
    setError(null);

    try {
      const data = await searchFederationRecipes(q.trim(), page, 12);
      setResults((prev) => append ? [...prev, ...data.results] : data.results);
      setPagination(data.pagination);
    } catch (err) {
      setError(`Search failed: ${(err as Error).message}`);
    } finally {
      setSearching(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    if (!query.trim()) { setResults([]); setPagination(null); return; }
    debounceRef.current = setTimeout(() => search(query), 300);
    return () => clearTimeout(debounceRef.current);
  }, [query, search]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleImport() {
    if (selected.size === 0) return;
    setImporting(true);
    setImportProgress({ done: 0, total: selected.size });
    setError(null);

    const ids = Array.from(selected);
    let done = 0;

    for (const id of ids) {
      try {
        const full = await getFederationRecipe(id);
        const recipe = cooklangToRecipe(full);
        await gql(CREATE_MUTATION, {
          title: recipe.title,
          description: recipe.description || null,
          instructions: recipe.instructions,
          servings: recipe.servings ?? null,
          prepTime: recipe.prepTime ?? null,
          cookTime: recipe.cookTime ?? null,
          tags: recipe.tags ?? [],
          photoUrl: recipe.photoUrl ?? null,
          ingredients: recipe.ingredients,
        });
      } catch (err) {
        console.error(`Failed to import recipe ${id}:`, err);
      }
      done++;
      setImportProgress({ done, total: ids.length });
    }

    setImporting(false);
    setImportProgress(null);
    navigate('/recipes#stage');
  }

  return (
    <div>
      <Link to="/recipes" className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
        &larr; Back to recipes
      </Link>

      <h1 className="text-3xl font-bold mb-2">Import Recipes</h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6 legible pretty">
        Search the <a href="https://cooklang.org" className="underline" rel="noopener noreferrer">Cooklang</a> Federation for community recipes. Select the ones you want and import them into your local pantry.
      </p>

      {/* Search */}
      <div className="relative mb-6">
        <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search federated recipes (e.g. pasta, chicken, breakfast)..."
          className="field-input w-full pl-9"
          autoFocus
        />
      </div>

      {error && (
        <p role="alert" className="text-sm text-red-400 mb-4">{error}</p>
      )}

      {/* Results grid */}
      {searching && results.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />
          ))}
        </div>
      )}

      {results.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
            {results.map((r) => {
              const isSelected = selected.has(r.id);
              return (
                <label
                  key={r.id}
                  className={`card rounded-xl p-4 cursor-pointer transition-colors ${isSelected ? 'border-[var(--color-accent)] bg-[var(--color-accent-subtle)]' : ''}`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelect(r.id)}
                      className="mt-1 w-4 h-4 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="font-semibold text-sm leading-snug">{r.title}</p>
                      {r.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {r.tags.slice(0, 4).map((t) => (
                            <span key={t} className="tag">{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </label>
              );
            })}
          </div>

          {/* Pagination */}
          {pagination && pagination.page < pagination.total_pages && (
            <div className="text-center mb-6">
              <button
                type="button"
                onClick={() => search(query, pagination.page + 1, true)}
                disabled={loadingMore}
                className="btn-secondary"
              >
                {loadingMore ? 'Loading\u2026' : `Load More (${results.length} of ${pagination.total})`}
              </button>
            </div>
          )}

          {/* Import action */}
          {selected.size > 0 && (
            <div className="sticky bottom-4 z-10 flex justify-center">
              <button
                type="button"
                onClick={handleImport}
                disabled={importing}
                aria-busy={importing}
                className="btn-primary shadow-lg"
              >
                {importing && importProgress
                  ? `Importing ${importProgress.done}/${importProgress.total}\u2026`
                  : `Import Selected (${selected.size})`}
              </button>
            </div>
          )}
        </>
      )}

      {!searching && query.trim() && results.length === 0 && (
        <p className="text-[var(--color-text-secondary)] text-sm text-center py-12">
          No recipes found for "{query}". Try a different search term.
        </p>
      )}

      {!query.trim() && (
        <p className="text-[var(--color-text-secondary)] text-sm text-center py-12">
          Start typing to search the Cooklang Federation's {'\u2248'}3,500 community recipes.
        </p>
      )}
    </div>
  );
}
