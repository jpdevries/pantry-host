import Head from 'next/head';
import { useState, useEffect, useMemo } from 'react';
import { gql } from '@/lib/gql';
import RecipeCard from '@/components/RecipeCard';
import { cacheSet, cacheGet } from '@pantry-host/shared/cache';
import { readFavorites } from '@pantry-host/shared/favorites';
import { Heart } from '@phosphor-icons/react';
import { isOwner } from '@/lib/isTrustedNetwork';
import { useKitchen } from '@/lib/kitchen-context';
import IngredientTypeahead from '@pantry-host/shared/components/IngredientTypeahead';
import { isBrowser, isServer } from '@pantry-host/shared/env';

interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  source: string;
  sourceUrl: string | null;
  tags: string[];
  photoUrl: string | null;
  queued: boolean;
}

const RECIPES_QUERY = `
  query Recipes($kitchenSlug: String) {
    recipes(kitchenSlug: $kitchenSlug) { id slug title cookTime prepTime servings source sourceUrl tags photoUrl queued }
  }
`;

const ADULT_TAGS = ['420', 'cannabis', 'adult-only'];

export default function RecipesIndexPage() {
  const kitchen = useKitchen();
  const cacheKey = `cache:recipes:${kitchen}`;
  const [recipes, setRecipes] = useState<Recipe[]>(() => cacheGet<Recipe[]>(cacheKey) ?? []);
  const [owner, setOwner] = useState(false);
  const [ageVerified, setAgeVerified] = useState(() => {
    if (isBrowser) return localStorage.getItem('age-verified') === 'true';
    return false;
  });
  const [search, setSearch] = useState(() => {
    if (isBrowser) {
      return new URLSearchParams(window.location.search).get('search') ?? '';
    }
    return '';
  });
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  // `?favorites=1` — intersect visible recipes with localStorage.favorites.
  // Off unless the URL explicitly asks. Hydrates after mount (same guard
  // as `search`) so SSR doesn't touch `window.location`.
  const [favoritesOnly, setFavoritesOnly] = useState(() => {
    if (isBrowser) {
      return new URLSearchParams(window.location.search).get('favorites') === '1';
    }
    return false;
  });
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  useEffect(() => { setFavoriteIds(readFavorites()); }, []);
  function clearFavoritesFilter() {
    setFavoritesOnly(false);
    if (isBrowser) {
      const url = new URL(window.location.href);
      url.searchParams.delete('favorites');
      window.history.replaceState({}, '', url);
    }
  }

  // Keyboard-flow mode. Revealed only on focus-within of <main id="stage">
  // (the main element adds `group/stage`). Default keeps the current
  // two-tab-per-card behavior. Persisted so power users don't re-pick.
  type KeyboardMode = 'nav-and-queue' | 'nav-only' | 'queue-only';
  const [keyboardMode, setKeyboardMode] = useState<KeyboardMode>(() => {
    if (isServer) return 'nav-and-queue';
    const v = localStorage.getItem('recipes-grid-keyboard-mode');
    return (v === 'nav-only' || v === 'queue-only' || v === 'nav-and-queue') ? v : 'nav-and-queue';
  });
  useEffect(() => {
    if (isBrowser) localStorage.setItem('recipes-grid-keyboard-mode', keyboardMode);
  }, [keyboardMode]);

  const base = `/kitchens/${kitchen}/recipes`;

  const placeholder = useMemo(() => {
    if (!recipes.length) return '';
    const r = recipes[Math.floor(Math.random() * recipes.length)];
    return r.title;
  }, [recipes]);

  useEffect(() => { setOwner(isOwner()); }, []);

  useEffect(() => {
    gql<{ recipes: Recipe[] }>(RECIPES_QUERY, { kitchenSlug: kitchen })
      .then((d) => { setRecipes(d.recipes); cacheSet(cacheKey, d.recipes); })
      .catch(() => {
        const cached = cacheGet<Recipe[]>(cacheKey);
        if (cached) setRecipes(cached);
      });
  }, [kitchen]);

  const RECIPE_FILTERS: { key: string; label: string; tags: string[] }[] = [
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
    { key: 'drink', label: 'Drink', tags: ['drink', 'juice', 'milkshake', 'coffee'] },
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

  const availableFilters = RECIPE_FILTERS.filter((f) =>
    recipes.some((r) => r.tags.some((t) => f.tags.includes(t.toLowerCase())))
  );

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <>
      <Head><title>Recipes — Pantry Host</title></Head>

      <main id="stage" className="group/stage max-sm:min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
        <a href={`${base}/feeds/bluesky#stage`} className="mb-8 flex items-center gap-4 card p-4 rounded-xl hover:border-accent transition-colors">
          <svg fill="currentColor" viewBox="0 0 600 530" width={32} height={28} aria-hidden="true" className="shrink-0 opacity-60" xmlns="http://www.w3.org/2000/svg">
            <path d="M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Browse recipes from Bluesky</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Discover recipes shared on AT Protocol by the community</p>
          </div>
        </a>

        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-4xl font-bold">Your Recipes</h1>
          {owner && (
            <div className="flex gap-2">
              <a href={`${base}/import#stage`} className="btn-secondary">↓ Import</a>
              <a href={`${base}/new#stage`} className="btn-primary">+ Add Recipe</a>
            </div>
          )}
        </div>

        {!ageVerified && recipes.some((r) => r.tags.some((t) => ADULT_TAGS.includes(t.toLowerCase()))) && (
          <div className="mb-6 p-4 border border-[var(--color-border-card)] bg-[var(--color-bg-card)] rounded flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Some recipes are marked as adult-only. <span className="font-medium">Are you 21 or older?</span>
            </p>
            <button
              type="button"
              onClick={() => { localStorage.setItem('age-verified', 'true'); setAgeVerified(true); }}
              className="btn-secondary text-sm"
            >
              Yes, I&rsquo;m 21+
            </button>
          </div>
        )}

        <div className="mb-4">
          <label htmlFor="recipe-search" className="field-label">Search</label>
          <div className="md:max-w-sm">
            <IngredientTypeahead
              id="recipe-search"
              mode="single"
              value={search}
              onChange={setSearch}
              placeholder={placeholder}
              suggestions={recipes.map((r) => r.title)}
              inputMode="search"
              enterKeyHint="search"
            />
          </div>
        </div>

        {/* Skip link — visible only on keyboard focus */}
        <a href="#recipe-list" className="sr-only focus:not-sr-only focus:inline-block focus:mb-2 focus:text-sm focus:underline focus:text-accent">
          Skip to recipes
        </a>

        {favoritesOnly && (
          <div className="mb-4 inline-flex items-center gap-2">
            <span
              className="tag inline-flex items-center gap-1"
              style={{ color: 'var(--color-accent)' }}
              title="Showing only favorited recipes"
            >
              <Heart size={12} weight="fill" aria-hidden />
              Favorites only
            </span>
            <button
              type="button"
              onClick={clearFavoritesFilter}
              className="text-xs text-[var(--color-text-secondary)] hover:underline px-2 py-1"
            >
              Show all recipes
            </button>
          </div>
        )}

        {availableFilters.length > 0 && (
          <div className="mb-6">
            <p id="filter-desc" className="text-xs text-[var(--color-text-secondary)] mb-2">Filter by tag</p>
            <div className="flex flex-wrap gap-2" role="group" aria-labelledby="filter-desc">
              {availableFilters.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => toggleFilter(f.key)}
                  aria-pressed={activeFilters.has(f.key)}
                  className="text-xs font-medium px-3 py-1.5 rounded-full border-2 transition-colors"
                  style={activeFilters.has(f.key)
                    ? { backgroundColor: 'var(--color-accent)', color: 'var(--color-bg-body)', borderColor: 'var(--color-accent)', fontWeight: 700 }
                    : { borderColor: 'var(--color-border-card)', color: 'var(--color-text-secondary)' }
                  }
                >
                  {f.label}
                </button>
              ))}
              {activeFilters.size > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveFilters(new Set())}
                  className="text-xs text-[var(--color-text-secondary)] hover:underline px-2 py-1.5"
                >
                  Clear
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mb-8 flex justify-end">
          <a href={`${base}/export#stage`} className="inline-flex items-center gap-1.5 text-sm text-secondary hover:underline">
            Export Recipes
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width={14} height={14} fill="currentColor" aria-hidden="true">
              <path d="M567.31 283.89l-71.78-68.16c-8.28-7.8-20.41-9.88-30.84-5.38-10.31 4.42-16.69 13.98-16.69 24.97V288h-64V131.97c0-12.7-5.1-25-14.1-33.99L286.02 14.1c-9-9-21.2-14.1-33.89-14.1H47.99C21.5.1 0 21.6 0 48.09v415.92C0 490.5 21.5 512 47.99 512h288.02c26.49 0 47.99-21.5 47.99-47.99V352h-31.99v112.01c0 8.8-7.2 16-16 16H47.99c-8.8 0-16-7.2-16-16V48.09c0-8.8 7.2-16.09 16-16.09h176.04v104.07c0 13.3 10.7 23.93 24 23.93h103.98v128H168c-4.42 0-8 3.58-8 8v16c0 4.42 3.58 8 8 8h280v52.67c0 10.98 6.38 20.55 16.69 24.97 14.93 6.45 26.88-1.61 30.88-5.39l71.72-68.12c5.62-5.33 8.72-12.48 8.72-20.12s-3.1-14.81-8.7-20.12zM256.03 128.07V32.59c2.8.7 5.3 2.1 7.4 4.2l83.88 83.88c2.1 2.1 3.5 4.6 4.2 7.4h-95.48zM480 362.88V245.12L542 304l-62 58.88z" />
            </svg>
          </a>
        </div>

        {(() => {
          const q = search.toLowerCase().trim();
          let visible = ageVerified
            ? recipes
            : recipes.filter((r) => !r.tags.some((t) => ADULT_TAGS.includes(t.toLowerCase())));
          if (favoritesOnly) {
            const favSet = new Set(favoriteIds);
            visible = visible.filter((r) => favSet.has(r.id));
          }
          const searched = q
            ? visible.filter((r) =>
                r.title.toLowerCase().includes(q) ||
                r.tags.some((t) => t.toLowerCase().includes(q))
              )
            : visible;
          const filtered = activeFilters.size === 0
            ? searched
            : searched.filter((r) => {
                const tags = r.tags.map((t) => t.toLowerCase());
                return [...activeFilters].every((fKey) => {
                  const f = RECIPE_FILTERS.find((rf) => rf.key === fKey);
                  return f && tags.some((t) => f.tags.includes(t));
                });
              });

          if (recipes.length === 0) return (
            <div className="text-center py-20 text-[var(--color-text-secondary)]">
              <p className="text-lg mb-4">No recipes yet.</p>
              {owner && (
                <p className="mb-4">
                  <a href="/#stage" className="underline hover:text-accent">Generate recipes from your pantry</a>
                  {' '}or{' '}
                  <a href={`${base}/new#stage`} className="underline hover:text-accent">add one manually</a>.
                </p>
              )}
            </div>
          );

          if (filtered.length === 0) return (
            <p className="text-center py-12 text-[var(--color-text-secondary)]">No recipes match &ldquo;{search}&rdquo;</p>
          );

          return (
            <>
              {/* Keyboard-flow toggle — hidden at rest, revealed only when
                  <main id="stage"> gains focus-within (group/stage above).
                  Lets keyboard users halve their tab stops per card. Mouse
                  and touch users never see this. */}
              <fieldset
                className="mb-6 card p-3 text-sm opacity-0 pointer-events-none transition-opacity duration-150 group-focus-within/stage:opacity-100 group-focus-within/stage:pointer-events-auto"
                aria-label="Keyboard navigation mode"
              >
                <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">User Flow</legend>
                <div className="flex flex-wrap gap-4 px-2">
                  {([
                    { value: 'nav-and-queue', label: 'Navigate & queue' },
                    { value: 'nav-only', label: 'Navigate only' },
                    { value: 'queue-only', label: 'Queue only' },
                  ] as const).map((opt) => (
                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="recipes-grid-keyboard-mode"
                        value={opt.value}
                        checked={keyboardMode === opt.value}
                        onChange={() => setKeyboardMode(opt.value)}
                        className="accent-accent"
                      />
                      <span>{opt.label}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

            <ul id="recipe-list" role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
              {filtered.map((r) => (
                <li key={r.id} className="grid grid-rows-[subgrid] row-span-4 mb-4">
                  <RecipeCard recipe={r} recipesBase={base} keyboardMode={keyboardMode} />
                </li>
              ))}
            </ul>
            </>
          );
        })()}
      </main>
    </>
  );
}
