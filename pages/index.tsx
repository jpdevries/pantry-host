import Head from 'next/head';
import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import GenerateButton from '@/components/GenerateButton';
import RecipeCard from '@/components/RecipeCard';

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
        <title>Pantry List</title>
        <meta name="description" content="Family recipe manager — pantry, cookware, and AI-generated recipes." />
      </Head>

      <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-4xl mx-auto">
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
          <StatCard label="Ingredients" value={ingredientCount} href="/ingredients#stage" icon={<CarrotIcon />} />
          <StatCard label="Recipes" value={data?.recipes.length ?? 0} href="/recipes#stage" icon={<BookIcon />} />
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

/* Font Awesome Pro 5.15.4 (light) — icon components */
const iconProps = { xmlns: 'http://www.w3.org/2000/svg', width: 20, height: 20, fill: 'currentColor', 'aria-hidden': true as const };

function CarrotIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 512 512">
      <path d="M504.6 138.5c-22.9-27.6-53.4-43.4-86.4-44.8-1.6-32.1-17.1-63.4-44.7-86.3-5.9-4.9-13.1-7.4-20.4-7.4-7.2 0-14.5 2.5-20.4 7.4-27.2 22.6-43.1 53-44.6 85.8-.7 14.5 1.8 28.7 6.6 42.2-13.3-4.4-26.8-7.3-40.3-7.3-48 0-94.1 26.8-116.6 72.8L2.4 478.3c-3 6.2-3.3 13.8 0 20.5 4.1 8.3 12.4 13.1 21 13.1 3.4 0 6.9-.8 10.2-2.4L311.2 374c25-12.2 46.4-32.6 59.6-59.6 15.4-31.5 16.7-66.2 6.5-97.1 11.8 4.1 23.9 6.6 36.4 6.6 34.7 0 67-15.9 90.9-44.7 9.9-11.7 9.9-28.9 0-40.7zm-162.5 162c-9.6 19.7-25.2 35.3-44.9 44.9l-124.8 60.9c-.4-.5-.6-1.1-1.1-1.6l-32-32c-6.2-6.2-16.4-6.2-22.6 0-6.2 6.2-6.2 16.4 0 22.6l25.6 25.6-100.2 49L154 240.6l26.7 26.7c3.1 3.1 7.2 4.7 11.3 4.7s8.2-1.6 11.3-4.7c6.2-6.2 6.2-16.4 0-22.6l-32-32c-.7-.7-1.7-1.1-2.5-1.7 17.1-31.5 49.4-51 85.6-51 14.9 0 29.2 3.3 42.7 9.9 23.4 11.4 41 31.3 49.5 56s6.9 51.1-4.5 74.6zM413.8 192c-21.5 0-43.1-8.9-60.6-26.5l-6.7-6.7c-37.2-37.1-35.4-92 6.6-126.8 33.2 27.5 41.5 67.6 25.3 101.6 11.2-5.3 23-8 34.9-8 24.1 0 48.3 11.1 66.7 33.3-18.3 22.1-42.3 33.1-66.2 33.1z" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 448 512">
      <path d="M356 160H188c-6.6 0-12-5.4-12-12v-8c0-6.6 5.4-12 12-12h168c6.6 0 12 5.4 12 12v8c0 6.6-5.4 12-12 12zm12 52v-8c0-6.6-5.4-12-12-12H188c-6.6 0-12 5.4-12 12v8c0 6.6 5.4 12 12 12h168c6.6 0 12-5.4 12-12zm64.7 268h3.3c6.6 0 12 5.4 12 12v8c0 6.6-5.4 12-12 12H80c-44.2 0-80-35.8-80-80V80C0 35.8 35.8 0 80 0h344c13.3 0 24 10.7 24 24v368c0 10-6.2 18.6-14.9 22.2-3.6 16.1-4.4 45.6-.4 65.8zM128 384h288V32H128v352zm-96 16c13.4-10 30-16 48-16h16V32H80c-26.5 0-48 21.5-48 48v320zm372.3 80c-3.1-20.4-2.9-45.2 0-64H80c-64 0-64 64 0 64h324.3z" />
    </svg>
  );
}

function MugHotIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 512 512">
      <path d="M416 192.1H32c-17.7 0-32 14.3-32 32V416c0 53 43 96 96 96h192c53 0 96-43 96-96v-32h32c52.9 0 96-43 96-96s-43.1-95.9-96-95.9zM352 416c0 35.3-28.7 64-64 64H96c-35.3 0-64-28.7-64-64V224.1h320V416zm64-64h-32V224h32c35.3 0 64 28.7 64 64s-28.7 64-64 64zM191.3 78.5c17.3 17.2 30.4 40.7 32.2 73.4.2 4.3 3.7 7.8 8 7.8h16c4.5 0 8.2-3.7 8-8.2-2.1-42.1-19.3-73.3-41.6-95.5-18.4-18.7-21.1-38.2-21.9-48.9-.3-4.1-3.9-7.1-8-7.1l-16 .1c-4.7 0-8.2 4-7.9 8.7.9 14.9 5.2 43.6 31.2 69.7zm-95.6 0c17.3 17.2 30.4 40.7 32.2 73.4.2 4.3 3.7 7.8 8 7.8h16c4.5 0 8.2-3.7 8-8.2-2.1-42.1-19.3-73.3-41.6-95.5-18.3-18.7-21-38.2-21.8-48.9C96.2 3 92.6 0 88.4 0l-16 .1c-4.7 0-8.2 4-7.9 8.7 1 14.9 5.2 43.6 31.2 69.7z" />
    </svg>
  );
}

function BoxOpenIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 608 512">
      <path d="M606.4 143.8L557.5 41c-2.7-5.6-8.1-9-13.9-9C543 32 304 64 304 64S65 32 64.4 32c-5.8 0-11.2 3.5-13.9 9L1.6 143.8c-4.4 9.2.3 20.2 9.6 23l49.5 14.9V393c0 14.7 9.5 27.5 23 31l205.4 54.1c13 3.4 23.7 1.5 29.5 0L524.2 424c13.5-3.6 23-16.4 23-31V181.7l49.5-14.9c9.4-2.8 14-13.8 9.7-23zM73 65.3l180.9 24.3-57.1 99.8-159.9-48.1 36.1-76zm18.2 125.6C208.3 226.1 200.5 224 203.6 224c5.4 0 10.5-2.9 13.3-7.9l71.9-125.5V445L91.2 393V190.9zM516.8 393l-197.6 52V90.5L391.1 216c2.9 5 8 7.9 13.3 7.9 3.1 0-5 2.1 112.4-33.1V393zM411.3 189.3l-57.1-99.8L535 65.3l36.1 76-159.8 48z" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 576 512">
      <path d="M546.2 9.7c-2.9-6.5-8.6-9.7-14.3-9.7-5.3 0-10.7 2.8-14 8.5C486.9 62.4 431.4 96 368 96h-80C182 96 96 182 96 288c0 20.9 3.4 40.9 9.6 59.7C29.3 413 1.4 489.4.9 490.7c-2.9 8.3 1.5 17.5 9.8 20.4 7.9 2.8 17.4-1.1 20.4-9.8.4-1.2 23.9-65.1 87.6-122.7C151.1 438.9 214.7 480 288 480c6.9 0 13.7-.4 20.4-1.1C465.5 467.5 576 326.8 576 154.3c0-50.2-10.8-102.2-29.8-144.6zM305 447.1c-5.9.6-11.6.9-17 .9-63.3 0-117.6-37.2-143.5-90.6C196.3 319 268.6 288 368 288c8.8 0 16-7.2 16-16s-7.2-16-16-16c-102.8 0-179 31-234.8 70.4-3.1-12.4-5.2-25.1-5.2-38.4 0-88.2 71.8-160 160-160h80c63.3 0 121-28.4 159.7-77.2 10.5 32.3 16.3 68.7 16.3 103.5 0 159.6-100.1 282.7-239 292.8z" />
    </svg>
  );
}

function TagIcon() {
  return (
    <svg {...iconProps} viewBox="0 0 512 512">
      <path d="M497.941 225.941L286.059 14.059A48 48 0 0 0 252.118 0H48C21.49 0 0 21.49 0 48v204.118a48 48 0 0 0 14.059 33.941l211.882 211.882c18.745 18.745 49.137 18.746 67.882 0l204.118-204.118c18.745-18.745 18.745-49.137 0-67.882zm-22.627 45.255L271.196 475.314c-6.243 6.243-16.375 6.253-22.627 0L36.686 263.431A15.895 15.895 0 0 1 32 252.117V48c0-8.822 7.178-16 16-16h204.118c4.274 0 8.292 1.664 11.314 4.686l211.882 211.882c6.238 6.239 6.238 16.39 0 22.628zM144 124c11.028 0 20 8.972 20 20s-8.972 20-20 20-20-8.972-20-20 8.972-20 20-20m0-28c-26.51 0-48 21.49-48 48s21.49 48 48 48 48-21.49 48-48-21.49-48-48-48z" />
    </svg>
  );
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  pantry: <BoxOpenIcon />,
  beverages: <MugHotIcon />,
  produce: <LeafIcon />,
};

function categoryIcon(s: string): React.ReactNode {
  return CATEGORY_ICONS[s] ?? <TagIcon />;
}
