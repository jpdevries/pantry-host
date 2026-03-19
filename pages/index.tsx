import Head from 'next/head';
import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import GenerateButton from '@/components/GenerateButton';
import RecipeCard from '@/components/RecipeCard';
import quotes from '@/lib/quotes.json';
import { Carrot, BookOpen, Coffee, Package, Leaf, Tag } from '@phosphor-icons/react';

interface HomeRecipe {
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

interface HomeData {
  ingredients: { id: string; category: string | null }[];
  cookware: { name: string }[];
  recipes: HomeRecipe[];
  kitchens: { id: string; slug: string; name: string }[];
}

const HOME_QUERY = `{
  ingredients { id category }
  cookware { name }
  recipes { id slug title cookTime prepTime servings source tags photoUrl queued }
  kitchens { id slug name }
}`;

export default function HomePage() {
  const [data, setData] = useState<HomeData | null>(null);
  const [isSecure, setIsSecure] = useState(false);
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);
  useEffect(() => { setQuote(quotes[Math.floor(Math.random() * quotes.length)]); }, []);

  useEffect(() => {
    gql<HomeData>(HOME_QUERY).then(setData).catch(console.error);
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    setIsSecure(isDev || window.location.protocol === 'https:');
  }, []);

  const [recipeLimit, setRecipeLimit] = useState(6);
  const [seasonalLimit, setSeasonalLimit] = useState(2);

  const ingredientCount = data?.ingredients.length ?? 0;
  const cookwareList = data?.cookware ?? [];
  const allRecipes = data?.recipes ?? [];
  const recentRecipes = allRecipes.slice(0, recipeLimit);
  const hasMore = allRecipes.length > recipeLimit;
  const kitchens = data?.kitchens ?? [];

  const season = currentSeason();
  const seasonalAll = allRecipes.filter((r) => r.tags.some((t) => t.toLowerCase() === season));
  const seasonalRecipes = seasonalAll.slice(0, seasonalLimit);
  const hasMoreSeasonal = seasonalAll.length > seasonalLimit;

  const categoryCounts = data
    ? Object.entries(
        data.ingredients.reduce<Record<string, number>>((acc, i) => {
          const k = i.category ?? 'other';
          acc[k] = (acc[k] ?? 0) + 1;
          return acc;
        }, {}),
      )
        .map(([category, count]) => ({ category, count }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <>
      <Head>
        <title>Pantry Host</title>
        <meta name="description" content="Family recipe manager — pantry, cookware, and AI-generated recipes." />
      </Head>

      <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-4xl mx-auto">
        {/* Quote (desktop only — mobile shows in nav) */}
        {quote && (
          <blockquote className="hidden sm:block mb-12 text-2xl italic text-zinc-500 dark:text-zinc-400 font-serif pretty text-center">
            <p>&ldquo;{quote.text}&rdquo;</p>
            <footer className="mt-2 text-base not-italic font-sans text-zinc-400 dark:text-zinc-500">— {quote.author}</footer>
          </blockquote>
        )}

        {/* Hero */}
        <section aria-labelledby="hero-heading" className="mb-8">
          <h1 id="hero-heading" className="text-4xl font-bold mb-3">
            What&apos;s in your kitchen?
          </h1>
          <p className="text-lg text-zinc-600 dark:text-zinc-400 max-w-prose">
            Manage your pantry and cookware, then let AI suggest recipes tailored to what you have on hand.
          </p>
        </section>

        {/* Kitchens */}
        {kitchens.length > 0 && (
          <section aria-labelledby="kitchens-heading" className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 id="kitchens-heading" className="text-sm font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">Kitchens</h2>
              <a href="/kitchens#stage" className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                {kitchens.length > 1 ? 'Manage →' : '+ Add kitchen'}
              </a>
            </div>
            <ul className="flex flex-wrap gap-3" role="list">
              {kitchens.map((k) => {
                const active = k.slug === 'home';
                return (
                <li key={k.id}>
                  <a
                    href={active ? '/#stage' : `/kitchens/${k.slug}#stage`}
                    aria-current={active ? 'true' : undefined}
                    className={[
                      'card block px-4 py-3 transition-colors',
                      active
                        ? 'border-amber-400 text-amber-600 dark:text-amber-400'
                        : 'hover:text-amber-600 dark:hover:text-amber-400',
                    ].join(' ')}
                  >
                    <span className="font-medium">{k.name}</span>
                    {active && (
                      <span className="ml-2 text-xs opacity-70">current</span>
                    )}
                  </a>
                </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Stats row */}
        <section aria-label="Pantry summary" className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          <StatCard label="Ingredients" value={ingredientCount} href="/ingredients#stage" icon={<Carrot size={20} aria-hidden />} />
          <StatCard label="Recipes" value={data?.recipes.length ?? 0} href="/recipes#stage" icon={<BookOpen size={20} aria-hidden />} />
          {categoryCounts.slice(0, 2).map((c) => (
            <StatCard key={c.category} label={categoryLabel(c.category)} value={c.count} href={`/ingredients#cat-${c.category}`} icon={categoryIcon(c.category)} />
          ))}
        </section>

        {/* Cookware chips — owner only */}
        {isSecure && cookwareList.length > 0 && (
          <section aria-label="Available cookware" className="mb-10">
            <h2 className="text-sm font-semibold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3">
              Cookware
            </h2>
            <ul className="flex flex-wrap gap-2" role="list">
              {cookwareList.map((c) => (
                <li key={c.name}><span className="tag">{c.name}</span></li>
              ))}
            </ul>
          </section>
        )}

        {/* Generate CTA — owner only (requires localhost or HTTPS) */}
        {isSecure && (
          <section aria-labelledby="ai-heading" className="mb-12">
            <h2 id="ai-heading" className="text-xl font-bold mb-2">Artificial Intelligence</h2>
            <p className="legible text-sm text-zinc-500 dark:text-zinc-400 mb-4">Generate a recipe based on the ingredients and cookware in your kitchen.<br />Your ingredient list is sent to the Anthropic API. Anthropic does not use API data to train models or sell it to third parties.</p>
            <GenerateButton ingredientCount={ingredientCount} />
          </section>
        )}

        {/* Seasonal recipes */}
        {seasonalRecipes.length > 0 && (
          <section aria-labelledby="seasonal-heading" className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 id="seasonal-heading" className="text-xl font-bold">{capitalize(season)} Recipes</h2>
              <a href={`/recipes?search=${season}#stage`} className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                All {season} recipes &rarr;
              </a>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {seasonalRecipes.map((r) => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
            {hasMoreSeasonal && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setSeasonalLimit((n) => n + 6)}
                  className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                  aria-describedby="seasonal-heading"
                >
                  Load more {season} recipes
                </button>
              </div>
            )}
          </section>
        )}

        {/* Recent recipes */}
        {recentRecipes.length > 0 && (
          <section aria-labelledby="recent-heading" className="mb-12">
            <div className="flex items-center justify-between mb-4">
              <h2 id="recent-heading" className="text-xl font-bold">Recent Recipes</h2>
              <a href="/recipes#stage" className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline">
                All recent recipes &rarr;
              </a>
            </div>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {recentRecipes.map((r) => (
                <RecipeCard key={r.id} recipe={r} />
              ))}
            </div>
            {hasMore && (
              <div className="mt-6 text-center">
                <button
                  type="button"
                  onClick={() => setRecipeLimit((n) => n + 6)}
                  className="text-sm font-semibold text-amber-600 dark:text-amber-400 hover:underline"
                  aria-describedby="recent-heading"
                >
                  Load more recent recipes
                </button>
              </div>
            )}
          </section>
        )}

      </main>
    </>
  );
}

function StatCard({ label, value, href, icon }: { label: string; value: number; href: string; icon?: React.ReactNode }) {
  return (
    <a href={href} className="card block pt-3 pb-5 px-5 hover:text-amber-600 dark:hover:text-amber-400 transition-colors text-center">
      {icon && <div className="text-zinc-400 dark:text-zinc-500 flex justify-center mb-2">{icon}</div>}
      <div className="text-3xl font-bold tabular-nums">{value}</div>
      <div className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">{label}</div>
    </a>
  );
}

const CATEGORY_LABELS: Record<string, string> = { pantry: 'Pantry Items' };

function categoryLabel(s: string) {
  return CATEGORY_LABELS[s] ?? capitalize(s);
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function currentSeason(): string {
  const m = new Date().getMonth(); // 0-indexed
  if (m >= 2 && m <= 4) return 'spring';
  if (m >= 5 && m <= 7) return 'summer';
  if (m >= 8 && m <= 10) return 'fall';
  return 'winter';
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  pantry: <Package size={20} aria-hidden />,
  beverages: <Coffee size={20} aria-hidden />,
  produce: <Leaf size={20} aria-hidden />,
};

function categoryIcon(s: string): React.ReactNode {
  return CATEGORY_ICONS[s] ?? <Tag size={20} aria-hidden />;
}
