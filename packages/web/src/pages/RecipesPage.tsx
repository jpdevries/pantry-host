import { useState, useEffect } from 'react';
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
          <PixabayImage recipe={{ id: recipe.id, title: recipe.title }} apiKey={pixabayKey!} alt={recipe.title} />
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
      // Default enabled: the feature is dormant without a key anyway, so
      // this effectively means "enabled the moment a key is added".
      enabled: window.localStorage.getItem('pixabay-fallback-enabled') !== 'false',
    };
  });
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handler = (e: StorageEvent) => {
      if (e.key === 'pixabay-api-key') {
        setState((prev) => ({ ...prev, key: e.newValue }));
        if (!e.newValue) clearPixabayCache();
      } else if (e.key === 'pixabay-fallback-enabled') {
        const nextEnabled = e.newValue !== 'false';
        setState((prev) => ({ ...prev, enabled: nextEnabled }));
        if (!nextEnabled) clearPixabayCache();
      }
    };
    window.addEventListener('storage', handler);
    return () => window.removeEventListener('storage', handler);
  }, []);
  return state;
}

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
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

  const filtered = recipes.filter(
    (r) =>
      r.title.toLowerCase().includes(search.toLowerCase()) ||
      r.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Recipes</h1>
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
        className="field-input w-full mb-6"
      />

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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
