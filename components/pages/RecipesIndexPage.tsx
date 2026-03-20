import Head from 'next/head';
import { useState, useEffect, useMemo } from 'react';
import { gql } from '@/lib/gql';
import RecipeCard from '@/components/RecipeCard';
import { cacheSet, cacheGet } from '@/lib/cache';

interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  source: string;
  tags: string[];
  photoUrl: string | null;
  queued: boolean;
}

const RECIPES_QUERY = `
  query Recipes($kitchenSlug: String) {
    recipes(kitchenSlug: $kitchenSlug) { id slug title cookTime prepTime servings source tags photoUrl queued }
  }
`;

interface Props { kitchen: string; }

const ADULT_TAGS = ['420', 'cannabis', 'adult-only'];

export default function RecipesIndexPage({ kitchen }: Props) {
  const cacheKey = `cache:recipes:${kitchen}`;
  const [recipes, setRecipes] = useState<Recipe[]>(() => cacheGet<Recipe[]>(cacheKey) ?? []);
  const [ageVerified, setAgeVerified] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('age-verified') === 'true';
    return false;
  });
  const [search, setSearch] = useState(() => {
    if (typeof window !== 'undefined') {
      return new URLSearchParams(window.location.search).get('search') ?? '';
    }
    return '';
  });

  const base = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  const placeholder = useMemo(() => {
    if (!recipes.length) return '';
    const r = recipes[Math.floor(Math.random() * recipes.length)];
    return r.title;
  }, [recipes]);

  useEffect(() => {
    gql<{ recipes: Recipe[] }>(RECIPES_QUERY, { kitchenSlug: kitchen })
      .then((d) => { setRecipes(d.recipes); cacheSet(cacheKey, d.recipes); })
      .catch(() => {
        const cached = cacheGet<Recipe[]>(cacheKey);
        if (cached) setRecipes(cached);
      });
  }, [kitchen]);

  return (
    <>
      <Head><title>Recipes — Pantry Host</title></Head>

      <datalist id="recipe-titles">
        {recipes.map((r) => <option key={r.id} value={r.title} />)}
      </datalist>

      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-4xl font-bold">Recipes</h1>
          <div className="flex gap-2">
            <a href={`${base}/import#stage`} className="btn-secondary">↓ Import</a>
            <a href={`${base}/new#stage`} className="btn-primary">+ Add Recipe</a>
          </div>
        </div>

        {!ageVerified && recipes.some((r) => r.tags.some((t) => ADULT_TAGS.includes(t.toLowerCase()))) && (
          <div className="mb-6 p-4 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900 rounded flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
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

        <div className="mb-8">
          <label htmlFor="recipe-search" className="field-label">Search</label>
          <input id="recipe-search" type="search" list="recipe-titles" placeholder={placeholder} value={search} onChange={(e) => setSearch(e.target.value)} className="field-input w-full md:max-w-sm" />
        </div>

        {(() => {
          const q = search.toLowerCase().trim();
          const visible = ageVerified
            ? recipes
            : recipes.filter((r) => !r.tags.some((t) => ADULT_TAGS.includes(t.toLowerCase())));
          const filtered = q
            ? visible.filter((r) =>
                r.title.toLowerCase().includes(q) ||
                r.tags.some((t) => t.toLowerCase().includes(q))
              )
            : visible;

          if (recipes.length === 0) return (
            <div className="text-center py-20 text-zinc-500 dark:text-zinc-400">
              <p className="text-lg mb-4">No recipes yet.</p>
              <p className="mb-4">
                <a href="/#stage" className="underline hover:text-accent">Generate recipes from your pantry</a>
                {' '}or{' '}
                <a href={`${base}/new#stage`} className="underline hover:text-accent">add one manually</a>.
              </p>
            </div>
          );

          if (filtered.length === 0) return (
            <p className="text-center py-12 text-zinc-500 dark:text-zinc-400">No recipes match &ldquo;{search}&rdquo;</p>
          );

          return (
            <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((r) => (
                <li key={r.id}>
                  <RecipeCard recipe={r} recipesBase={base} />
                </li>
              ))}
            </ul>
          );
        })()}
      </main>
    </>
  );
}
