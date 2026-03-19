import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import { cacheGet, cacheSet } from '@/lib/cache';
import RecipeCard from '@/components/RecipeCard';

interface MenuRecipe {
  id: string;
  course: string | null;
  sortOrder: number;
  recipe: {
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
      recipe { id slug title cookTime prepTime servings source tags photoUrl queued }
    }
  }
}`;

const DELETE_MENU = `mutation DeleteMenu($id: String!) { deleteMenu(id: $id) }`;

const COURSE_LABELS: Record<string, string> = {
  appetizer: 'Appetizers',
  'main-course': 'Main Course',
  dessert: 'Dessert',
  other: 'Other',
};

const COURSE_ORDER = ['appetizer', 'main-course', 'dessert', 'other'];

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
  const menusBase = kitchen === 'home' ? '/menus' : `/kitchens/${kitchen}/menus`;
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  useEffect(() => {
    setIsDev(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  }, []);

  useEffect(() => {
    if (!menuId) return;
    const cacheKey = `cache:menu:${menuId}`;
    gql<{ menu: Menu | null }>(MENU_QUERY, { id: menuId })
      .then((d) => {
        if (!d.menu || (!d.menu.active && !isDev)) { setNotFound(true); return; }
        setMenu(d.menu);
        cacheSet(cacheKey, d.menu);
      })
      .catch(() => {
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
      <main id="stage" className="min-h-screen flex flex-col items-center justify-center">
        <p className="text-lg font-semibold mb-4">Menu not found</p>
        <a href={menusBase} className="text-amber-600 dark:text-amber-400 hover:underline">&larr; Back to Menus</a>
      </main>
    );
  }

  if (!menu) {
    return (
      <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-4" />
          <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-2/3 mb-8" />
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="card p-4 h-48" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  // Group recipes by course
  const byCourse = new Map<string, MenuRecipe[]>();
  for (const mr of menu.recipes) {
    const course = mr.course || 'other';
    if (!byCourse.has(course)) byCourse.set(course, []);
    byCourse.get(course)!.push(mr);
  }

  // Sort courses in canonical order
  const sortedCourses = [...byCourse.keys()].sort(
    (a, b) => (COURSE_ORDER.indexOf(a) === -1 ? 99 : COURSE_ORDER.indexOf(a)) - (COURSE_ORDER.indexOf(b) === -1 ? 99 : COURSE_ORDER.indexOf(b))
  );

  return (
    <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-2">
        <a href={menusBase} className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline">
          &larr; Menus
        </a>
        {isDev && (
          <div className="flex gap-2">
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
          </div>
        )}
      </div>

      <h1 className="text-3xl font-bold mb-2">{menu.title}</h1>
      {menu.description && (
        <p className="legible text-zinc-500 dark:text-zinc-400 mb-8">{menu.description}</p>
      )}

      {sortedCourses.map((course) => {
        const items = byCourse.get(course)!;
        return (
          <section key={course} className="mb-10" aria-labelledby={`course-${course}`}>
            <h2 id={`course-${course}`} className="text-xl font-bold mb-4">
              {COURSE_LABELS[course] || course}
            </h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((mr) => (
                <RecipeCard key={mr.id} recipe={mr.recipe} recipesBase={recipesBase} />
              ))}
            </div>
          </section>
        );
      })}
    </main>
  );
}
