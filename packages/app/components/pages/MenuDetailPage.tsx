import { useState, useEffect, useCallback, useRef } from 'react';
import { gql } from '@/lib/gql';
import { cacheGet, cacheSet } from '@pantry-host/shared/cache';
import RecipeCard from '@/components/RecipeCard';
import { Robot, Leaf, ArrowsOut, ArrowsIn } from '@phosphor-icons/react';

interface MenuRecipe {
  id: string;
  course: string | null;
  sortOrder: number;
  recipe: {
    id: string;
    slug: string | null;
    title: string;
    description: string | null;
    cookTime: number | null;
    prepTime: number | null;
    servings: number | null;
    source: string;
    tags: string[];
    photoUrl: string | null;
    queued: boolean;
  };
}

interface Menu {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  active: boolean;
  recipes: MenuRecipe[];
}

const MENU_QUERY = `query Menu($id: String!) {
  menu(id: $id) {
    id slug title description active
    recipes {
      id course sortOrder
      recipe { id slug title description cookTime prepTime servings source tags photoUrl queued }
    }
  }
}`;

const DELETE_MENU = `mutation DeleteMenu($id: String!) { deleteMenu(id: $id) }`;

const COURSE_LABELS: Record<string, string> = {
  appetizer: 'Appetizers',
  breakfast: 'Breakfast',
  'main-course': 'Main Course',
  side: 'Sides',
  beverage: 'Beverages',
  dessert: 'Dessert',
  other: 'Other',
};

/** If the course label would be redundant with the menu title, use a generic alternative. */
function courseLabel(course: string, menuTitle: string): string {
  const label = COURSE_LABELS[course] || course;
  if (label.toLowerCase() === menuTitle.toLowerCase()) return 'Plates';
  return label;
}

const COURSE_ORDER = ['appetizer', 'breakfast', 'main-course', 'side', 'beverage', 'dessert', 'other'];

interface Props {
  kitchen: string;
  menuId: string;
}

export default function MenuDetailPage({ kitchen, menuId }: Props) {
  const [menu, setMenu] = useState<Menu | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [activeFilters, setActiveFilters] = useState<Set<string>>(new Set());
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState(false);
  const articleRef = useRef<HTMLElement>(null);
  const menusBase = kitchen === 'home' ? '/menus' : `/kitchens/${kitchen}/menus`;
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  useEffect(() => {
    setIsDev(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    setSupportsFullscreen(Boolean(document.documentElement.requestFullscreen || (document.documentElement as any).webkitRequestFullscreen));
  }, []);

  const enterZen = useCallback(async () => {
    if (!articleRef.current) return;
    try { await articleRef.current.requestFullscreen(); } catch { /* ignored */ }
  }, []);

  const exitZen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    function onFSChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    let lock: WakeLockSentinel | null = null;
    async function acquire() {
      try { lock = await navigator.wakeLock.request('screen'); } catch { /* ignored */ }
    }
    async function onVisibilityChange() {
      if (document.visibilityState === 'visible' && isFullscreen) await acquire();
    }
    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { lock?.release().catch(() => {}); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [isFullscreen]);

  useEffect(() => {
    console.log('[MenuDetailPage] menuId:', JSON.stringify(menuId));
    if (!menuId) return;
    const cacheKey = `cache:menu:${menuId}`;
    const dev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    gql<{ menu: Menu | null }>(MENU_QUERY, { id: menuId })
      .then((d) => {
        if (!d.menu || (!d.menu.active && !dev)) { setNotFound(true); return; }
        setMenu(d.menu);
        cacheSet(cacheKey, d.menu);
      })
      .catch((err) => {
        console.error('[MenuDetailPage] gql error:', err);
        const cached = cacheGet<Menu>(cacheKey);
        if (cached) setMenu(cached);
      });
  }, [menuId]);

  async function handleDelete() {
    if (!menu) return;
    setDeleting(true);
    try {
      await gql(DELETE_MENU, { id: menu.id });
      window.location.href = `${menusBase}#stage`;
    } catch {
      setDeleting(false);
    }
  }

  if (notFound) {
    return (
      <main id="stage" className="max-sm:min-h-screen flex flex-col items-center justify-center">
        <p className="text-lg font-semibold mb-4">Menu not found</p>
        <a href={menusBase} className="text-accent hover:underline">&larr; Back to Menus</a>
      </main>
    );
  }

  if (!menu) {
    return (
      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-[var(--color-accent-subtle)] rounded w-1/3 mb-4" />
          <div className="h-4 bg-[var(--color-accent-subtle)] rounded w-2/3 mb-8" />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-4 h-48" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Filter definitions: label, matching tags, icon
  const MENU_FILTERS: { key: string; label: string; tags: string[] }[] = [
    { key: 'gluten-free', label: 'Gluten-Free', tags: ['gluten-free'] },
    { key: 'vegan', label: 'Vegan', tags: ['vegan'] },
    { key: 'vegetarian', label: 'Vegetarian', tags: ['vegetarian', 'vegan'] },
    { key: 'pescatarian', label: 'Pescatarian', tags: ['pescatarian'] },
    { key: 'sustainable', label: 'Sustainable', tags: ['sustainable', 'local'] },
  ];

  // Only show filters that match at least one recipe on this menu
  const availableFilters = MENU_FILTERS.filter((f) =>
    menu.recipes.some((mr) => mr.recipe.tags.some((t) => f.tags.includes(t.toLowerCase())))
  );

  function toggleFilter(key: string) {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  // Apply filters
  const filtered = activeFilters.size === 0
    ? menu.recipes
    : menu.recipes.filter((mr) => {
        const tags = mr.recipe.tags.map((t) => t.toLowerCase());
        return [...activeFilters].every((fKey) => {
          const f = MENU_FILTERS.find((mf) => mf.key === fKey);
          return f && tags.some((t) => f.tags.includes(t));
        });
      });

  // Group recipes by course — if assigned "other", infer from recipe tags
  const byCourse = new Map<string, MenuRecipe[]>();
  for (const mr of filtered) {
    let course = mr.course || 'other';
    if (course === 'other') {
      const tags = mr.recipe.tags.map((t) => t.toLowerCase());
      const inferred = COURSE_ORDER.find((c) => c !== 'other' && tags.includes(c));
      if (inferred) course = inferred;
    }
    if (!byCourse.has(course)) byCourse.set(course, []);
    byCourse.get(course)!.push(mr);
  }

  // Sort courses in canonical order
  const sortedCourses = [...byCourse.keys()].sort(
    (a, b) => (COURSE_ORDER.indexOf(a) === -1 ? 99 : COURSE_ORDER.indexOf(a)) - (COURSE_ORDER.indexOf(b) === -1 ? 99 : COURSE_ORDER.indexOf(b))
  );

  return (
    <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
      <article ref={articleRef}>
      <button
        type="button"
        onClick={exitZen}
        aria-label="Exit full screen"
        className="zen-exit-btn fixed top-4 right-4 z-50 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full backdrop-blur transition-colors hidden outline outline-1 outline-current"
      >
        <ArrowsIn size={18} aria-hidden />
      </button>
      <div className="flex items-center justify-between mb-2">
        <a href={menusBase} className="text-sm text-[var(--color-text-secondary)] hover:underline">
          &larr; Menus
        </a>
        <div className="flex gap-2">
          {supportsFullscreen && (
            <button type="button" onClick={isFullscreen ? exitZen : enterZen} aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} aria-pressed={isFullscreen} className="btn-secondary p-2">
              {isFullscreen ? <ArrowsIn size={18} aria-hidden /> : <ArrowsOut size={18} aria-hidden />}
            </button>
          )}
        {isDev && (<>
            <a href={`${menusBase}/${menu.slug ?? menu.id}/edit`} className="btn-secondary text-sm">Edit</a>
            {!deleteConfirm ? (
              <button type="button" onClick={() => setDeleteConfirm(true)} className="btn-secondary text-sm text-red-500">
                Delete
              </button>
            ) : (
              <div className="flex gap-2">
                <button type="button" onClick={handleDelete} disabled={deleting} className="btn-secondary text-sm text-red-500" autoFocus>
                  {deleting ? 'Deleting...' : 'Confirm Delete'}
                </button>
                <button type="button" onClick={() => setDeleteConfirm(false)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            )}
          </>)}
        </div>
      </div>

      <h1 className="text-3xl font-bold mb-2">{menu.title}</h1>
      {menu.description && (
        <p className="legible text-[var(--color-text-secondary)] mb-6 pretty">{menu.description}</p>
      )}

      {availableFilters.length > 0 && (
        <div className="mb-8">
          <p id="filter-desc" className="text-xs text-[var(--color-text-secondary)] mb-2">Filter dishes by dietary preference</p>
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="filter-desc">
          {availableFilters.map((f) => {
            const active = activeFilters.has(f.key);
            return (
              <button
                key={f.key}
                type="button"
                onClick={() => toggleFilter(f.key)}
                aria-pressed={active}
                className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-accent border-accent text-[var(--color-bg-body)]'
                    : 'border-[var(--color-border-card)] text-[var(--color-text-secondary)] hover:border-accent hover:text-accent'
                }`}
              >
                {f.label}
              </button>
            );
          })}
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

      {/* Classic print-style menu */}
      <div className="mb-16 max-w-2xl">
        {sortedCourses.map((course) => {
          const items = byCourse.get(course)!;
          return (
            <section key={course} className="mb-8" aria-labelledby={`classic-${course}`}>
              <h2 id={`classic-${course}`} className="text-base font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-4">
                {courseLabel(course, menu.title)}
              </h2>
              <ul role="list" className="space-y-8">
                {items.map((mr) => {
                  const r = mr.recipe;
                  const isGlutenFree = r.tags.some((t) => t.toLowerCase() === 'gluten-free');
                  const isCannabis = r.tags.some((t) => ['420', 'cannabis', 'adult-only'].includes(t.toLowerCase()));
                  const isAI = r.source === 'ai-generated';
                  const isSustainable = r.tags.some((t) => ['sustainable', 'local'].includes(t.toLowerCase()));
                  return (
                    <li key={mr.id}>
                      <div className="flex items-baseline gap-2">
                        <a
                          href={`${recipesBase}/${r.slug ?? r.id}#stage`}
                          className="text-xl font-serif font-semibold hover:text-accent transition-colors legible"
                        >
                          {r.title}
                        </a>
                        <span className="flex items-center gap-1.5 shrink-0 translate-y-0.5">
                          {isCannabis && (
                            <span className="text-green-600 dark:text-green-400" title="Contains cannabis">
                              <CannabisIcon />
                              <span className="sr-only">Contains cannabis</span>
                            </span>
                          )}
                          {isSustainable && (
                            <span className="text-green-600 dark:text-green-400" title="Locally sourced">
                              <Leaf size={14} aria-hidden />
                              <span className="sr-only">Locally sourced</span>
                            </span>
                          )}
                          {isGlutenFree && (
                            <span className="text-green-600 dark:text-green-400" title="Gluten-free">
                              <WheatIcon />
                              <span className="sr-only">Gluten-free</span>
                            </span>
                          )}
                          {isAI && (
                            <span className="text-[var(--color-text-secondary)]" title="AI-generated">
                              <Robot size={14} aria-hidden />
                              <span className="sr-only">AI-generated</span>
                            </span>
                          )}
                        </span>
                      </div>
                      {r.description && (
                        <p className="text-lg font-serif text-[var(--color-text-secondary)] mt-0.5 legible">{r.description}</p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      <hr className="border-[var(--color-border-card)] mb-10" />

      {/* Full recipe cards */}
      {sortedCourses.map((course) => {
        const items = byCourse.get(course)!;
        return (
          <section key={course} className="mb-10" aria-labelledby={`course-${course}`}>
            <h2 id={`course-${course}`} className="text-xl font-bold mb-4">
              {courseLabel(course, menu.title)}
            </h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((mr) => (
                <RecipeCard key={mr.id} recipe={mr.recipe} recipesBase={recipesBase} />
              ))}
            </div>
          </section>
        );
      })}
      </article>
    </main>
  );
}

function CannabisIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M494.42 323.43c-1.2-.6-19.6-9.78-47.96-17.83 48.3-64.24 63.94-129.7 64.72-133.04a31.977 31.977 0 0 0-8.31-29.62 31.997 31.997 0 0 0-22.86-9.61c-2.19 0-4.4.23-6.59.69-3.34.7-66.31 14.35-130.68 55.97-8.59-97.8-57.86-172.39-60.14-175.8C276.64 5.32 266.67 0 256 0s-20.64 5.32-26.58 14.19c-2.29 3.41-51.56 78.01-60.14 175.8-64.37-41.62-127.34-55.27-130.68-55.97-2.19-.46-4.4-.69-6.59-.69-8.51 0-16.78 3.4-22.86 9.61a31.991 31.991 0 0 0-8.31 29.62c.77 3.34 16.42 68.79 64.72 133.04-28.37 8.05-46.77 17.23-47.96 17.83A32 32 0 0 0 0 351.98a32.005 32.005 0 0 0 17.54 28.57c2.3 1.17 54.42 27.19 120.97 29.89-2.84 6.84-4.26 11.06-4.41 11.51A31.999 31.999 0 0 0 164.48 464c3.04 0 6.11-.43 9.12-1.33 1.66-.49 31.46-9.55 66.39-30.71V504c0 4.42 3.58 8 8 8h16c4.42 0 8-3.58 8-8v-72.03c34.94 21.16 64.74 30.21 66.39 30.71 3.01.89 6.08 1.33 9.12 1.33 8.53 0 16.86-3.41 22.97-9.72a31.982 31.982 0 0 0 7.41-32.33c-.15-.45-1.56-4.67-4.41-11.51 66.55-2.71 118.66-28.73 120.97-29.89 10.77-5.45 17.55-16.5 17.54-28.57s-6.79-23.12-17.56-28.56zM362.4 378.66c-17.33 0-31.19-.9-42.49-2.42-.22.12-.4.16-.62.28 19.8 30.01 28.23 55.48 28.23 55.48s-48.08-14.3-91.52-50.5c-43.44 36.2-91.52 50.5-91.52 50.5s8.43-25.47 28.23-55.48c-.22-.12-.4-.16-.62-.28-11.3 1.53-25.16 2.42-42.49 2.42C84.65 378.66 32 352 32 352s40.95-20.67 95.13-25.58c-.85-.8-1.57-1.36-2.43-2.18C53.02 255.98 32 165.33 32 165.33s95.18 20.02 166.85 88.28c.93.89 1.57 1.63 2.48 2.51-.85-11.28-1.33-23.67-1.33-37.46C200 115.57 256 32 256 32s56 83.57 56 186.67c0 13.79-.48 26.18-1.33 37.46.91-.88 1.55-1.62 2.48-2.51C384.82 185.35 480 165.33 480 165.33s-21.02 90.64-92.7 158.9c-.86.82-1.58 1.38-2.43 2.18C439.05 331.33 480 352 480 352s-52.65 26.66-117.6 26.66z" />
    </svg>
  );
}

function WheatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M454.06 171.37c-4.44-4.43-9.24-8.25-14.25-11.64 14.69-5.26 28.28-12.24 39.23-22.42 26.58-28.86 34.78-75.04 32.64-120.09-.44-9.23-8.03-16.47-17.26-16.91-4.28-.19-8.76-.31-13.4-.31-34.31 0-76.99 6.42-105.77 33.15-10.84 10.88-18.32 24.1-23.46 37.97-3.19-4.56-6.61-9.01-10.68-13.07l-34.45-34.43c-6.24-6.24-16.37-6.25-22.62 0L250.33 57.3c-17.5 17.49-26.49 40.07-27.66 62.97l-6.34-6.33c-6.24-6.24-16.37-6.25-22.62 0L160 147.63c-17.58 17.57-26.59 40.28-27.69 63.3l-6.48-6.48c-6.24-6.24-16.37-6.25-22.62 0L69.5 238.14c-37.51 37.49-37.51 98.3 0 135.8l22.96 22.95-87.76 87.8c-6.25 6.25-6.25 16.38 0 22.62C7.81 510.44 11.91 512 16 512s8.19-1.56 11.31-4.69l87.55-87.59 22.84 22.83c18.74 18.73 43.3 28.1 67.87 28.1s49.12-9.37 67.87-28.1l33.77-33.75c6.25-6.25 6.25-16.38 0-22.63l-6.47-6.47c22.98-1.11 45.66-10.11 63.21-27.66l33.77-33.75c6.25-6.25 6.25-16.38 0-22.63l-6.33-6.32c22.87-1.19 45.42-10.16 62.89-27.62l33.77-33.75c6.25-6.25 6.25-16.38 0-22.63l-33.99-33.97zM397.03 56.59c21.59-20.06 56.82-24.48 82.96-24.59-.21 36.03-8.62 65.65-23.67 82.71-21.99 19.63-56.99 23.78-82.66 23.78h-.38c-.34-25.94 3.95-61.99 23.75-81.9zM272.95 79.94l22.4-22.39 23.14 23.12c24.38 24.37 25.42 64.13.69 89.69-.29.25-.66.34-.93.62l-22.38 22.39-22.92-22.91c-25.01-24.99-25.04-65.49 0-90.52zm-90.33 90.33l22.4-22.39 23.14 23.13c13.62 13.62 33.75 53.21 1.95 88.16l-24.55 24.56-22.94-22.93c-25.02-25-25.04-65.5 0-90.53zM92.11 351.31c-25.02-25-25.04-65.5 0-90.53l22.4-22.39 23.14 23.13c23.78 23.76 25.63 62.42 1.75 88.4l-24.33 24.34-22.96-22.95zm158.7 68.61c-25 24.98-65.46 25.01-90.49 0l-22.66-22.65 22.45-22.43c24.99-24.98 65.46-25.02 90.49 0l22.66 22.65-22.45 22.43zm90.51-90.51c-25 24.98-65.46 25.01-90.49 0l-22.66-22.65 22.45-22.43c24.99-24.98 65.46-25.02 90.49 0l22.66 22.65-22.45 22.43zm90.33-90.33c-25 24.98-65.46 25.01-90.49 0l-22.66-22.65L340.95 194c24.99-24.98 65.46-25.02 90.49 0l22.66 22.65-22.45 22.43z" />
    </svg>
  );
}
