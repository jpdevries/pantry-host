import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { getFileURL } from '@/lib/storage-opfs';
import { Trash, ArrowsOut, ArrowsIn } from '@phosphor-icons/react';
import { classifyRecipeCourse, COURSE_LABELS } from '@pantry-host/shared/constants';
import PixabayImage from '@pantry-host/shared/components/PixabayImage';
import { clearPixabayCache } from '@pantry-host/shared/pixabay';
import PublishToBlueskyButton from '@pantry-host/shared/components/PublishToBlueskyButton';

interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  instructions: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  tags: string[];
  photoUrl: string | null;
  sourceUrl: string | null;
  createdAt: string | null;
  queued: boolean;
  groceryIngredients: Array<{
    ingredientName: string;
    quantity: number | null;
    unit: string | null;
    itemSize: number | null;
    itemSizeUnit: string | null;
  }>;
}

interface MenuRecipe {
  id: string;
  course: string | null;
  sortOrder: number;
  recipe: Recipe;
}

interface Menu {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  active: boolean;
  category: string | null;
  recipes: MenuRecipe[];
}

const MENU_QUERY = `query($id: String!) {
  menu(id: $id) {
    id slug title description active category
    recipes {
      id course sortOrder
      recipe {
        id slug title description instructions cookTime prepTime servings tags
        photoUrl sourceUrl createdAt queued
        groceryIngredients { ingredientName quantity unit itemSize itemSizeUnit }
      }
    }
  }
}`;

/** Resolves opfs:// URLs to blob URLs */
function RecipePhoto({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    if (src.startsWith('opfs://')) {
      getFileURL(src.replace('opfs://', '')).then(setResolved).catch(() => setResolved(null));
    } else {
      setResolved(src);
    }
  }, [src]);
  if (!resolved) return null;
  return <img src={resolved} alt={alt} className={className} loading="lazy" />;
}

/** Read Pixabay key + enabled flag from localStorage; live-update on
 *  Settings saves via the `storage` event. Defaults to disabled until
 *  the user opts in. Mirrors the hook in RecipesPage. */
function usePixabaySettings(): { key: string | null; enabled: boolean } {
  const [state, setState] = useState<{ key: string | null; enabled: boolean }>(() => {
    if (typeof window === 'undefined') return { key: null, enabled: false };
    return {
      key: window.localStorage.getItem('pixabay-api-key'),
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

export default function MenuDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState(false);
  const articleRef = useRef<HTMLDivElement>(null);
  const pixabay = usePixabaySettings();
  const pixabayActive = pixabay.enabled && !!pixabay.key;

  useEffect(() => {
    setSupportsFullscreen(Boolean(document.documentElement.requestFullscreen || (document.documentElement as any).webkitRequestFullscreen));
    function onFSChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  useEffect(() => {
    if (!slug) return;
    gql<{ menu: Menu | null }>(MENU_QUERY, { id: slug })
      .then((d) => setMenu(d.menu))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleDelete() {
    if (!menu) return;
    await gql(`mutation($id: String!) { deleteMenu(id: $id) }`, { id: menu.id });
    navigate('/menus#stage');
  }

  if (loading) return <div className="h-40 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />;
  if (!menu) return <p className="text-[var(--color-text-secondary)]">Menu not found.</p>;

  // Group recipes by course
  const grouped: Record<string, MenuRecipe[]> = {};
  for (const mr of menu.recipes) {
    const course = mr.course || classifyRecipeCourse(mr.recipe.tags) || 'other';
    (grouped[course] ??= []).push(mr);
  }
  for (const group of Object.values(grouped)) {
    group.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const courseOrder = ['appetizer', 'breakfast', 'main-course', 'side', 'beverage', 'dessert', 'other'];
  const sortedCourses = Object.keys(grouped).sort((a, b) => {
    const ai = courseOrder.indexOf(a);
    const bi = courseOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  return (
    <div>
      <Link to="/menus#stage" className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
        &larr; Menus
      </Link>

      {/* Action bar */}
      <div className="flex items-center justify-end gap-3 flex-wrap pb-4 mb-6 border-b" style={{ borderColor: 'var(--color-border-card)' }}>
        <div className="flex items-center gap-3 flex-wrap">
          <Link to={`/menus/${slug}/edit#stage`} className="btn-secondary text-sm">Edit</Link>
          {deleteConfirm ? (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-[var(--color-text-secondary)]">Delete?</span>
              <button type="button" autoFocus onClick={handleDelete} className="btn-danger text-sm">Yes</button>
              <button type="button" onClick={() => setDeleteConfirm(false)} className="btn-secondary text-sm">No</button>
            </div>
          ) : (
            <button type="button" onClick={() => setDeleteConfirm(true)} className="btn-secondary btn-delete text-sm">Delete</button>
          )}
          {supportsFullscreen && (
            <button
              type="button"
              onClick={() => {
                if (isFullscreen) document.exitFullscreen().catch(() => {});
                else articleRef.current?.requestFullscreen().catch(() => {});
              }}
              aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
              className="btn-secondary p-2"
            >
              {isFullscreen ? <ArrowsIn size={18} aria-hidden /> : <ArrowsOut size={18} aria-hidden />}
            </button>
          )}
        </div>
      </div>

      <div ref={articleRef}>
      <h1 className="text-3xl font-bold">{menu.title}</h1>
      {menu.description && (
        <p className="text-[var(--color-text-secondary)] mt-1 mb-6 legible pretty">{menu.description}</p>
      )}
      <div className="flex gap-2 mb-8">
        {menu.category && <span className="tag">{menu.category}</span>}
        {!menu.active && <span className="tag">inactive</span>}
      </div>

      {menu.recipes.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm">
          No recipes in this menu yet. <Link to={`/menus/${slug}/edit#stage`} className="underline">Add some.</Link>
        </p>
      ) : (
        <>
          {/* Classic print-style menu */}
          <div className="space-y-10 mb-10">
            {sortedCourses.map((course) => (
              <section key={`classic-${course}`}>
                <h2 className="text-base font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-4">
                  {COURSE_LABELS[course] || course}
                </h2>
                <ul className="space-y-8">
                  {grouped[course].map((mr) => (
                    <li key={mr.id}>
                      <Link
                        to={`/recipes/${mr.recipe.slug || mr.recipe.id}#stage`}
                        className="text-xl font-serif font-semibold hover:underline"
                      >
                        {mr.recipe.title}
                      </Link>
                      {mr.recipe.description && (
                        <p className="text-lg font-serif text-[var(--color-text-secondary)] mt-1 legible pretty">
                          {mr.recipe.description}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          <hr className="border-[var(--color-border-card)] mb-10" />

          {/* Recipe card grid */}
          <div className="space-y-10">
            {sortedCourses.map((course) => (
              <section key={`cards-${course}`}>
                <h2 className="text-xl font-bold mb-4">
                  {COURSE_LABELS[course] || course}
                </h2>
                <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                  {grouped[course].map((mr) => {
                    const r = mr.recipe;
                    const totalTime = (r.prepTime ?? 0) + (r.cookTime ?? 0);
                    return (
                      <Link key={mr.id} to={`/recipes/${r.slug || r.id}#stage`} className="card rounded-xl overflow-hidden group">
                        {r.photoUrl ? (
                          <div className="aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
                            <RecipePhoto src={r.photoUrl} alt={r.title} className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform" />
                          </div>
                        ) : pixabayActive ? (
                          <PixabayImage recipe={{ id: r.id, title: r.title }} apiKey={pixabay.key!} alt={r.title} inCard />
                        ) : (
                          <div className="aspect-[16/9] bg-[var(--color-bg-card)]" />
                        )}
                        <div className="p-4">
                          <h3 className="font-bold text-base leading-snug">{r.title}</h3>
                          <span className="text-sm text-[var(--color-text-secondary)]">
                            {[totalTime > 0 && `${totalTime} min`, r.servings && `${r.servings} servings`].filter(Boolean).join(' \u00b7 ')}
                          </span>
                          {r.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {r.tags.slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}
                            </div>
                          )}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        </>
      )}

      {/* Publish to AT Protocol — requires auth, honors dry-run. */}
      <div className="no-print mt-16 pt-8 border-t border-[var(--color-border-card)] flex justify-center">
        <PublishToBlueskyButton
          kind="menu"
          menu={{
            id: menu.id,
            title: menu.title,
            description: menu.description,
            createdAt: null,
            recipes: menu.recipes.map((mr) => ({
              id: mr.recipe.id,
              title: mr.recipe.title,
              description: mr.recipe.description,
              instructions: mr.recipe.instructions,
              servings: mr.recipe.servings,
              prepTime: mr.recipe.prepTime,
              cookTime: mr.recipe.cookTime,
              tags: mr.recipe.tags,
              sourceUrl: mr.recipe.sourceUrl,
              photoUrl: mr.recipe.photoUrl,
              createdAt: mr.recipe.createdAt,
              groceryIngredients: mr.recipe.groceryIngredients,
            })),
          }}
        />
      </div>
      </div>
    </div>
  );
}
