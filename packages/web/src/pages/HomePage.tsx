import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { BookOpen, Wine, ForkKnife, CookingPot, Leaf, Flask, Heart } from '@phosphor-icons/react';
import { readFavorites } from '@pantry-host/shared/favorites';
import { getFileURL } from '@/lib/storage-opfs';

const COMMUNITY_SOURCES = [
  { name: 'TheMealDB', tab: 'mealdb', icon: ForkKnife, catalog: '~300 recipes', blurb: 'Browse by category, cuisine, or ingredient.' },
  { name: 'Cooklang Federation', tab: 'cooklang', icon: BookOpen, catalog: '3,500+ recipes', blurb: 'Community recipes in the standardized .cook format.' },
  { name: 'Wikibooks Cookbook', tab: 'wikibooks', icon: Leaf, catalog: '~3,900 recipes', blurb: 'The largest catalog. Cached locally for offline browsing.' },
  { name: 'Public Domain Recipes', tab: 'publicdomain', icon: CookingPot, catalog: '408 recipes', blurb: 'Truly public domain \u2014 no attribution required.' },
  { name: 'Recipe API', tab: 'recipe-api', icon: Flask, catalog: 'Proprietary', blurb: 'USDA-backed nutrition data per serving.' },
  { name: 'TheCocktailDB', tab: 'cocktaildb', icon: Wine, catalog: '~600 cocktails', blurb: 'Drinks-only companion to TheMealDB.' },
];

interface Kitchen {
  id: string;
  slug: string;
  name: string;
}

interface HomeRecipe {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  photoUrl: string | null;
  prepTime: number | null;
  cookTime: number | null;
}

interface Stats {
  recipes: HomeRecipe[];
  ingredients: { id: string }[];
  cookware: { id: string }[];
  kitchens: Kitchen[];
}

const STATS_QUERY = `
  query Home($kitchenSlug: String) {
    recipes(kitchenSlug: $kitchenSlug) { id slug title tags photoUrl prepTime cookTime }
    ingredients(kitchenSlug: $kitchenSlug) { id }
    cookware(kitchenSlug: $kitchenSlug) { id }
    kitchens { id slug name }
  }
`;

/** Lightweight favorite-card for the home-page grid. Full-featured
 *  cards with queue + Pixabay fallback live in RecipesPage; the home
 *  surface is view-only so we keep this compact. */
function FavoriteCard({ recipe }: { recipe: HomeRecipe }) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  useEffect(() => {
    if (!recipe.photoUrl) return;
    if (recipe.photoUrl.startsWith('opfs://')) {
      getFileURL(recipe.photoUrl.replace('opfs://', '')).then(setPhotoSrc).catch(() => {});
    } else {
      setPhotoSrc(recipe.photoUrl);
    }
  }, [recipe.photoUrl]);
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  return (
    <Link
      to={`/recipes/${recipe.slug || recipe.id}#stage`}
      className="card rounded-xl overflow-hidden flex flex-col hover:border-[var(--color-accent)] transition-colors"
    >
      {photoSrc ? (
        <div className="aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
          <img
            src={photoSrc}
            alt=""
            loading="lazy"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div className="aspect-[16/9] bg-[var(--color-bg-card)]" aria-hidden />
      )}
      <div className="p-4 flex-1 flex flex-col">
        <h3 className="font-semibold text-sm leading-snug mb-1 hover:underline">{recipe.title}</h3>
        {totalTime > 0 && (
          <p className="text-xs text-[var(--color-text-secondary)]">{totalTime} min</p>
        )}
      </div>
    </Link>
  );
}

export default function HomePage() {
  const { kitchen: kitchenParam } = useParams<{ kitchen?: string }>();
  const kitchen = kitchenParam ?? 'home';
  const navigate = useNavigate();
  // Collapse /kitchens/home to its canonical /, so the switcher has one
  // URL to highlight and bookmarks don't fork. Runs once on mount.
  useEffect(() => {
    if (kitchenParam === 'home') navigate('/#stage', { replace: true });
  }, [kitchenParam, navigate]);

  const [stats, setStats] = useState<Stats | null>(null);
  const [favoritesLimit, setFavoritesLimit] = useState(3);
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);

  useEffect(() => {
    gql<Stats>(STATS_QUERY, { kitchenSlug: kitchen }).then(setStats).catch(console.error);
    setFavoriteIds(readFavorites());
  }, [kitchen]);

  // Path prefix for every internal link. Home kitchen keeps bare paths;
  // named kitchens get `/kitchens/{slug}/…`.
  const base = kitchen === 'home' ? '' : `/kitchens/${kitchen}`;
  const isHomeKitchen = kitchen === 'home';
  const kitchenName = stats?.kitchens.find((k) => k.slug === kitchen)?.name ?? kitchen;

  const cards = [
    { label: 'Recipes', count: stats?.recipes.length ?? 0, to: `${base}/recipes` },
    { label: 'Ingredients', count: stats?.ingredients.length ?? 0, to: `${base}/ingredients` },
    { label: 'Cookware', count: stats?.cookware.length ?? 0, to: `${base}/cookware` },
  ];

  // Favorites: intersect localStorage IDs with the actual recipe list
  // so deletions / other-origin writes silently drop out.
  const favoriteSet = new Set(favoriteIds);
  const favoritesAll = (stats?.recipes ?? []).filter((r) => favoriteSet.has(r.id));
  const favoriteRecipes = favoritesAll.slice(0, favoritesLimit);
  const hasMoreFavorites = favoritesAll.length > favoritesLimit;

  return (
    <div>
      <h1
        className="text-3xl font-bold mb-8"
      >
        {isHomeKitchen ? 'Your Kitchen' : kitchenName}
      </h1>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {cards.map(({ label, count, to }) => (
          <Link
            key={to}
            to={`${to}#stage`}
            className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-6 hover:underline transition-colors"
          >
            <p className="text-3xl font-bold">{stats ? count : '—'}</p>
            <p className="text-sm text-[var(--color-text-secondary)] mt-1">{label}</p>
          </Link>
        ))}
      </div>

      {/* Favorites — read from localStorage.favorites, intersected with
          the current recipe list. Silent when empty. */}
      {favoriteRecipes.length > 0 && (
        <section aria-labelledby="favorites-heading" className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 id="favorites-heading" className="text-xl font-bold inline-flex items-center gap-2">
              <Heart size={18} weight="fill" aria-hidden className="opacity-70" />
              Your Favorites
            </h2>
            <Link to={`${base}/recipes?favorites=1#stage`} className="text-sm font-semibold text-[var(--color-accent)] hover:underline">
              All favorites &rarr;
            </Link>
          </div>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {favoriteRecipes.map((r) => (
              <FavoriteCard key={r.id} recipe={r} />
            ))}
          </div>
          {hasMoreFavorites && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={() => setFavoritesLimit((n) => n + 6)}
                className="text-sm font-semibold text-[var(--color-accent)] hover:underline"
                aria-describedby="favorites-heading"
              >
                Load more favorites
              </button>
            </div>
          )}
        </section>
      )}

      {/* Kitchens */}
      {stats && stats.kitchens.length > 0 && (
        <section aria-labelledby="kitchens-heading" className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 id="kitchens-heading" className="text-sm font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">Kitchens</h2>
            <Link to="/kitchens#stage" className="text-sm font-semibold text-[var(--color-accent)] hover:underline">
              {stats.kitchens.length > 1 ? 'Manage \u2192' : '+ Add kitchen'}
            </Link>
          </div>
          <ul className="flex flex-wrap gap-3" role="list">
            {stats.kitchens.map((k) => {
              const active = k.slug === kitchen;
              const to = k.slug === 'home' ? '/#stage' : `/kitchens/${k.slug}#stage`;
              return (
                <li key={k.id}>
                  <Link
                    to={to}
                    aria-current={active ? 'true' : undefined}
                    className={`card block px-4 py-3 rounded-xl transition-colors ${active ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : 'hover:text-[var(--color-accent)]'}`}
                  >
                    <span className="font-medium">{k.name}</span>
                    {active && <span className="ml-2 text-xs opacity-70">current</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <h2 id="whats-cooking" className="text-3xl font-bold mb-4">What&rsquo;s Cooking?</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <Link to={`${base}/recipes/feeds/bluesky`} className="card rounded-xl p-5 flex items-center gap-4 hover:border-[var(--color-accent)] transition-colors">
          <svg fill="currentColor" viewBox="0 0 600 530" width={28} height={24} aria-hidden="true" className="shrink-0 opacity-60">
            <path d="M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z" />
          </svg>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Browse recipes from Bluesky</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Discover community recipes shared on AT Protocol</p>
          </div>
        </Link>
        <Link to={`${base}/menus/feeds/bluesky`} className="card rounded-xl p-5 flex items-center gap-4 hover:border-[var(--color-accent)] transition-colors">
          <div className="shrink-0 opacity-60 relative w-[28px] h-[24px]">
            <svg fill="currentColor" viewBox="0 0 600 530" width={16} height={14} aria-hidden="true" className="absolute top-0 left-0"><path d="M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z" /></svg>
            <svg fill="currentColor" viewBox="0 0 600 530" width={12} height={10} aria-hidden="true" className="absolute top-[6px] right-0"><path d="M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z" /></svg>
            <svg fill="currentColor" viewBox="0 0 600 530" width={10} height={9} aria-hidden="true" className="absolute bottom-0 left-[4px]"><path d="M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z" /></svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">Browse menus from Bluesky</p>
            <p className="text-xs text-[var(--color-text-secondary)]">Import curated recipe collections from the community</p>
          </div>
        </Link>
      </div>

      <h3 className="text-xl font-bold mb-4">Community Sources</h3>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4 max-w-prose pretty">
        Import from recipe communities directly inside the app via <Link to={`${base}/recipes/import#stage`} className="underline hover:text-[var(--color-accent)]">Recipes &rarr; Import</Link>.
      </p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {COMMUNITY_SOURCES.map((s) => (
          <Link key={s.name} to={`${base}/recipes/import?tab=${s.tab}#stage`} className="card rounded-xl p-4 flex flex-col hover:border-[var(--color-accent)] transition-colors">
            <div className="flex items-center gap-2 mb-2">
              <s.icon size={18} weight="light" className="opacity-60 shrink-0" />
              <p className="font-semibold text-sm">{s.name}</p>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] mb-1">{s.catalog}</p>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{s.blurb}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-6">
        <h2 className="font-semibold mb-2">Browser-native mode</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          All your data is stored locally in your browser using PGlite. No server, no account, no tracking.
          Your recipes, ingredients, and cookware persist across sessions on this device.
        </p>
        <div className="border-t border-[var(--color-border-card)] pt-4">
          <p className="text-sm font-semibold mb-1">Ready for more?</p>
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            Self-host on a Mac&nbsp;Mini or Raspberry&nbsp;Pi to sync across every device in your household.
            One kitchen, shared by everyone at&nbsp;home.
          </p>
          <a
            href="https://pantryhost.app#getting-started"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--color-accent)] hover:underline"
          >
            See self-hosted capabilities &rarr;
          </a>
        </div>
      </div>
    </div>
  );
}
