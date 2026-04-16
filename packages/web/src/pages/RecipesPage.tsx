import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { getFileURL } from '@/lib/storage-opfs';
import { ShoppingCart } from '@phosphor-icons/react';
import { HIDDEN_TAGS } from '@pantry-host/shared/constants';
import { recipeApiIdFromSourceUrl } from '@pantry-host/shared/recipe-api';
import PixabayImage from '@pantry-host/shared/components/PixabayImage';
import { clearPixabayCache } from '@pantry-host/shared/pixabay';

interface Recipe {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  tags: string[];
  photoUrl: string | null;
  sourceUrl: string | null;
  prepTime: number | null;
  cookTime: number | null;
  servings: number | null;
  queued: boolean;
  createdAt: string;
}

const RECIPES_QUERY = `{
  recipes { id slug title description tags photoUrl sourceUrl prepTime cookTime servings queued createdAt }
}`;

/**
 * Returns false for sources we know never have images (recipe-api, today).
 * Returns true for everything else — hand-entered recipes, Cooklang, etc. —
 * so their cards still reserve an image zone (rendered as placeholder or
 * Pixabay fallback depending on settings).
 */
function recipeSourceHasImages(recipe: { sourceUrl: string | null }): boolean {
  if (!recipe.sourceUrl) return true;
  if (recipeApiIdFromSourceUrl(recipe.sourceUrl)) return false;
  return true;
}

const TOGGLE_QUEUED = `mutation($id: String!) { toggleRecipeQueued(id: $id) { id queued } }`;

function RecipeCard({
  recipe,
  onToggleQueue,
  pixabayKey,
  pixabayEnabled,
}: {
  recipe: Recipe;
  onToggleQueue: (id: string) => void;
  pixabayKey: string | null;
  pixabayEnabled: boolean;
}) {
  const [photoSrc, setPhotoSrc] = useState<string | null>(null);
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const visibleTags = recipe.tags.filter((t) => !HIDDEN_TAGS.has(t.toLowerCase()));

  useEffect(() => {
    if (!recipe.photoUrl) return;
    if (recipe.photoUrl.startsWith('opfs://')) {
      getFileURL(recipe.photoUrl.replace('opfs://', '')).then(setPhotoSrc).catch(() => {});
    } else {
      setPhotoSrc(recipe.photoUrl);
    }
  }, [recipe.photoUrl]);

  // Decide how to render the image zone.
  //  1. recipe has own photo             → real photo
  //  2. Pixabay fallback configured      → PixabayImage (borrowed, attribution overlay)
  //  3. source "normally has images"     → empty 16:9 placeholder (existing behavior)
  //  4. source has no images (recipe-api) → compact text card, no image zone at all
  const pixabayActive = pixabayEnabled && !!pixabayKey;
  let imageZone: 'own' | 'pixabay' | 'placeholder' | 'none';
  if (photoSrc) imageZone = 'own';
  else if (pixabayActive) imageZone = 'pixabay';
  else if (recipeSourceHasImages(recipe)) imageZone = 'placeholder';
  else imageZone = 'none';

  return (
    <div className="card rounded-xl overflow-hidden group">
      {imageZone === 'own' && (
        <Link to={`/recipes/${recipe.slug || recipe.id}#stage`} className="block aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]" tabIndex={-1} aria-hidden="true">
          <img
            src={photoSrc!}
            alt={recipe.title}
            className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
            loading="lazy"
          />
        </Link>
      )}
      {imageZone === 'pixabay' && (
        <Link to={`/recipes/${recipe.slug || recipe.id}#stage`} className="block overflow-hidden" tabIndex={-1} aria-hidden="true">
          <PixabayImage recipe={{ id: recipe.id, title: recipe.title }} apiKey={pixabayKey!} alt={recipe.title} inCard />
        </Link>
      )}
      {imageZone === 'placeholder' && (
        <div className="aspect-[16/9] bg-[var(--color-bg-card)]" />
      )}

      {/* Title + queue toggle */}
      <div className="px-4 pt-3 flex items-start justify-between gap-2">
        <Link
          to={`/recipes/${recipe.slug || recipe.id}#stage`}
          className="font-bold text-base leading-snug hover:underline line-clamp-2"
        >
          {recipe.title}
        </Link>
        <button
          type="button"
          onClick={(e) => { e.preventDefault(); onToggleQueue(recipe.id); }}
          aria-label={recipe.queued ? `Remove ${recipe.title} from list` : `Add ${recipe.title} to list`}
          aria-pressed={recipe.queued}
          className={`add-to-list-cta w-7 h-7 flex items-center justify-center shrink-0 ${recipe.queued ? 'is-active' : ''}`}
        >
          <ShoppingCart size={14} aria-hidden />
        </button>
      </div>

      {/* Metadata */}
      <div className="px-4 pt-1 flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
        {totalTime > 0 && <span>{totalTime} min</span>}
        {recipe.servings != null && <span>{recipe.servings} servings</span>}
      </div>

      {/* Tags */}
      {visibleTags.length > 0 && (
        <div className="px-4 pt-2 pb-3 flex flex-wrap gap-1">
          {visibleTags.slice(0, 4).map((t) => (
            <span key={t} className="tag">{t}</span>
          ))}
        </div>
      )}
      {visibleTags.length === 0 && <div className="pb-3" />}
    </div>
  );
}

function usePixabaySettings(): { key: string | null; enabled: boolean } {
  const [state, setState] = useState<{ key: string | null; enabled: boolean }>(() => {
    if (typeof window === 'undefined') return { key: null, enabled: true };
    return {
      key: window.localStorage.getItem('pixabay-api-key'),
      // Default OFF — opt-in feature. User must explicitly toggle on
      // in Settings (after adding a key).
      enabled: window.localStorage.getItem('pixabay-fallback-enabled') === 'true',
    };
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === 'pixabay-api-key') {
        setState((prev) => ({ ...prev, key: e.newValue }));
        if (!e.newValue) clearPixabayCache();
      } else if (e.key === 'pixabay-fallback-enabled') {
        const nextEnabled = e.newValue === 'true';
        setState((prev) => ({ ...prev, enabled: nextEnabled }));
        if (!nextEnabled) clearPixabayCache();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return state;
}

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

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const pixabay = usePixabaySettings();

  useEffect(() => {
    gql<{ recipes: Recipe[] }>(RECIPES_QUERY)
      .then((d) => setRecipes(d.recipes))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function handleToggleQueue(id: string) {
    // Optimistic update
    setRecipes((prev) => prev.map((r) => r.id === id ? { ...r, queued: !r.queued } : r));
    try {
      const data = await gql<{ toggleRecipeQueued: { id: string; queued: boolean } }>(TOGGLE_QUEUED, { id });
      setRecipes((prev) => prev.map((r) => r.id === data.toggleRecipeQueued.id ? { ...r, queued: data.toggleRecipeQueued.queued } : r));
    } catch {
      setRecipes((prev) => prev.map((r) => r.id === id ? { ...r, queued: !r.queued } : r));
    }
  }

  const availableFilters = useMemo(() =>
    RECIPE_FILTERS.filter((f) =>
      recipes.some((r) => r.tags.some((t) => f.tags.includes(t.toLowerCase())))
    ), [recipes]);

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  const searched = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );
  const filtered = activeFilters.size === 0
    ? searched
    : searched.filter((r) => {
        const tags = r.tags.map((t) => t.toLowerCase());
        return [...activeFilters].every((fKey) => {
          const f = RECIPE_FILTERS.find((rf) => rf.key === fKey);
          return f && tags.some((t) => f.tags.includes(t));
        });
      });

  return (
    <div>
      <Link to="/recipes/feeds/bluesky" className="mb-6 flex items-center gap-4 card p-4 rounded-xl hover:border-[var(--color-accent)] transition-colors">
        <svg fill="currentColor" viewBox="0 0 600 530" width={32} height={28} aria-hidden="true" className="shrink-0 opacity-60" xmlns="http://www.w3.org/2000/svg">
          <path d="M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Browse recipes from Bluesky</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Discover recipes shared on AT Protocol by the community</p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Your Recipes</h1>
        <div className="flex gap-2">
          <Link to="/recipes/import#stage" className="btn-secondary">Import</Link>
          <Link to="/recipes/new#stage" className="btn-primary">New recipe</Link>
        </div>
      </div>

      <input
        type="search"
        placeholder="Search recipes..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="field-input w-full mb-4"
      />

      {/* Skip link — visible only on keyboard focus */}
      <a href="#recipe-list" className="sr-only focus:not-sr-only focus:inline-block focus:mb-2 focus:text-sm focus:underline focus:text-[var(--color-accent)]">
        Skip to recipes
      </a>

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

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm">
          {recipes.length === 0
            ? 'No recipes yet. Create your first one!'
            : 'No recipes match your search.'}
        </p>
      ) : (
        <div id="recipe-list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map((r) => (
            <RecipeCard
              key={r.id}
              recipe={r}
              onToggleQueue={handleToggleQueue}
              pixabayKey={pixabay.key}
              pixabayEnabled={pixabay.enabled}
            />
          ))}
        </div>
      )}
    </div>
  );
}
