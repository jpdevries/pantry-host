import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { Trash, PencilSimple } from '@phosphor-icons/react';
import { classifyRecipeCourse, COURSE_LABELS } from '@pantry-host/shared/constants';

interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  tags: string[];
  photoUrl: string | null;
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
      recipe { id slug title cookTime prepTime servings tags photoUrl }
    }
  }
}`;

export default function MenuDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState(false);

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
  // Sort each group by sortOrder
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
      <Link to="/menus" className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
        &larr; Menus
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-3xl font-bold">{menu.title}</h1>
          {menu.description && (
            <p className="text-[var(--color-text-secondary)] mt-1">{menu.description}</p>
          )}
          <div className="flex gap-2 mt-2">
            {menu.category && <span className="tag">{menu.category}</span>}
            {!menu.active && <span className="tag">inactive</span>}
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Link
            to={`/menus/${slug}/edit`}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-2"
            aria-label="Edit menu"
          >
            <PencilSimple size={16} aria-hidden />
          </Link>
          {deleteConfirm ? (
            <div className="flex gap-1 items-center">
              <span className="text-xs text-[var(--color-text-secondary)] mr-1">Delete?</span>
              <button type="button" autoFocus onClick={handleDelete} className="btn-danger text-xs px-2 py-1" style={{ minHeight: 'auto' }}>Yes</button>
              <button type="button" onClick={() => setDeleteConfirm(false)} className="btn-secondary text-xs px-2 py-1" style={{ minHeight: 'auto' }}>No</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="text-[var(--color-text-secondary)] hover:text-red-500 p-2"
              aria-label="Delete menu"
            >
              <Trash size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {menu.recipes.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm">
          No recipes in this menu yet. <Link to={`/menus/${slug}/edit`} className="underline">Add some.</Link>
        </p>
      ) : (
        <div className="space-y-8">
          {sortedCourses.map((course) => (
            <section key={course}>
              <h2 className="text-lg font-bold mb-3 capitalize">
                {COURSE_LABELS[course] || course}
              </h2>
              <ul className="space-y-2">
                {grouped[course].map((mr) => (
                  <li key={mr.id}>
                    <Link
                      to={`/recipes/${mr.recipe.slug || mr.recipe.id}`}
                      className="block card rounded-xl p-4 hover:underline"
                    >
                      <span className="font-semibold text-sm">{mr.recipe.title}</span>
                      <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                        {[
                          mr.recipe.prepTime && `${mr.recipe.prepTime}m prep`,
                          mr.recipe.cookTime && `${mr.recipe.cookTime}m cook`,
                          mr.recipe.servings && `${mr.recipe.servings} servings`,
                        ].filter(Boolean).join(' \u00b7 ')}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
