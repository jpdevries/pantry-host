import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';

interface RecipeOption {
  id: string;
  slug: string | null;
  title: string;
  tags: string[];
  photoUrl: string | null;
}

interface SelectedRecipe {
  recipeId: string;
  course: string;
  title: string;
}

const RECIPES_QUERY = `query Recipes($kitchenSlug: String) { recipes(kitchenSlug: $kitchenSlug) { id slug title tags photoUrl } }`;

const MENU_QUERY = `query Menu($id: String!) {
  menu(id: $id) {
    id slug title description active
    recipes { id course sortOrder recipe { id title } }
  }
}`;

const UPDATE_MENU = `mutation UpdateMenu($id: String!, $title: String, $description: String, $active: Boolean, $recipes: [MenuRecipeInput!]) {
  updateMenu(id: $id, title: $title, description: $description, active: $active, recipes: $recipes) { id slug }
}`;

const COURSE_TAGS: Record<string, string[]> = {
  appetizer: ['appetizer', 'apps', 'starter'],
  'main-course': ['main-course', 'dinner', 'entree', 'lunch'],
  dessert: ['dessert', 'sweets', 'baking'],
};

const COURSE_LABELS: Record<string, string> = {
  appetizer: 'Appetizers',
  'main-course': 'Main Course',
  dessert: 'Dessert',
  other: 'Other',
};

function classifyRecipe(recipe: RecipeOption): string {
  const tags = recipe.tags.map((t) => t.toLowerCase());
  for (const [course, courseTags] of Object.entries(COURSE_TAGS)) {
    if (tags.some((t) => courseTags.includes(t))) return course;
  }
  return 'other';
}

interface Props {
  kitchen: string;
  menuId: string;
}

export default function MenuEditPage({ kitchen, menuId }: Props) {
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [selected, setSelected] = useState<SelectedRecipe[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [menuDbId, setMenuDbId] = useState('');
  const [loading, setLoading] = useState(true);
  const menusBase = kitchen === 'home' ? '/menus' : `/kitchens/${kitchen}/menus`;
  const slug = kitchen === 'home' ? undefined : kitchen;

  useEffect(() => {
    Promise.all([
      gql<{ recipes: RecipeOption[] }>(RECIPES_QUERY, { kitchenSlug: slug }),
      gql<{ menu: { id: string; slug: string; title: string; description: string | null; recipes: { course: string; recipe: { id: string; title: string } }[] } }>(MENU_QUERY, { id: menuId }),
    ]).then(([r, m]) => {
      setRecipes(r.recipes);
      if (m.menu) {
        setMenuDbId(m.menu.id);
        setTitle(m.menu.title);
        setDescription(m.menu.description ?? '');
        setActive(m.menu.active ?? true);
        setSelected(m.menu.recipes.map((mr) => ({
          recipeId: mr.recipe.id,
          course: mr.course || 'other',
          title: mr.recipe.title,
        })));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [kitchen, menuId]);

  const grouped: Record<string, RecipeOption[]> = { appetizer: [], 'main-course': [], dessert: [], other: [] };
  for (const r of recipes) {
    const course = classifyRecipe(r);
    grouped[course].push(r);
  }
  for (const arr of Object.values(grouped)) arr.sort((a, b) => a.title.localeCompare(b.title));

  const selectedIds = new Set(selected.map((s) => s.recipeId));

  function toggleRecipe(recipe: RecipeOption, course: string) {
    if (selectedIds.has(recipe.id)) {
      setSelected((prev) => prev.filter((s) => s.recipeId !== recipe.id));
    } else {
      setSelected((prev) => [...prev, { recipeId: recipe.id, course, title: recipe.title }]);
    }
  }

  function removeSelected(recipeId: string) {
    setSelected((prev) => prev.filter((s) => s.recipeId !== recipeId));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required'); return; }
    if (selected.length === 0) { setError('Add at least one recipe'); return; }
    setSaving(true);
    setError('');
    try {
      const data = await gql<{ updateMenu: { id: string; slug: string } }>(UPDATE_MENU, {
        id: menuDbId,
        title: title.trim(),
        description: description.trim() || null,
        active,
        recipes: selected.map((s, i) => ({ recipeId: s.recipeId, course: s.course, sortOrder: i })),
      });
      window.location.href = `${menusBase}/${data.updateMenu.slug}#stage`;
    } catch {
      setError('Failed to update menu');
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-zinc-200 dark:bg-zinc-700 rounded w-1/3 mb-6" />
          <div className="h-10 bg-zinc-200 dark:bg-zinc-700 rounded w-full mb-4" />
          <div className="h-20 bg-zinc-200 dark:bg-zinc-700 rounded w-full" />
        </div>
      </main>
    );
  }

  return (
    <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
      <a href={`${menusBase}/${menuId}`} className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline mb-4 inline-block">
        &larr; Back to menu
      </a>
      <h1 className="text-3xl font-bold mb-6">Edit Menu</h1>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1" htmlFor="menu-title">Title</label>
          <input
            id="menu-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-1" htmlFor="menu-desc">Description</label>
          <textarea
            id="menu-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
          />
        </div>

        <label className="flex items-center gap-2 mb-6 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-amber-500" />
          <span className="text-sm font-semibold">Active</span>
          <span className="text-xs text-zinc-500 dark:text-zinc-400">— visible to guests when checked</span>
        </label>

        <h2 className="text-xl font-bold mb-4">Select Recipes</h2>

        {['appetizer', 'main-course', 'dessert', 'other'].map((course) => {
          const items = grouped[course];
          if (items.length === 0) return null;
          return (
            <fieldset key={course} className="mb-6">
              <legend className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
                {COURSE_LABELS[course]}
              </legend>
              <div className="space-y-1">
                {items.map((r) => (
                  <label key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleRecipe(r, course)}
                      className="w-4 h-4 accent-amber-500"
                    />
                    <span className="text-sm">{r.title}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          );
        })}

        {selected.length > 0 && (
          <div className="mb-6">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-2">
              Your Menu ({selected.length} {selected.length === 1 ? 'recipe' : 'recipes'})
            </h3>
            <ul className="space-y-1">
              {selected.map((s) => (
                <li key={s.recipeId} className="flex items-center justify-between px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50">
                  <span className="text-sm">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-zinc-400 dark:text-zinc-500 ml-2">{COURSE_LABELS[s.course]}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSelected(s.recipeId)}
                    className="text-zinc-400 hover:text-red-500 text-sm"
                    aria-label={`Remove ${s.title}`}
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <p className="text-red-500 text-sm mb-4">{error}</p>}

        <div className="flex gap-3">
          <button type="submit" disabled={saving} className="btn-primary">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <a href={`${menusBase}/${menuId}`} className="btn-secondary">Cancel</a>
        </div>
      </form>
    </main>
  );
}
