import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import { enqueue } from '@/lib/offlineQueue';
import { MENU_CATEGORIES, COURSE_TAGS, COURSE_LABELS, classifyRecipeCourse } from '@pantry-host/shared/constants';

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
    id slug title description active category
    recipes { id course sortOrder recipe { id title } }
  }
}`;

const UPDATE_MENU = `mutation UpdateMenu($id: String!, $title: String, $description: String, $active: Boolean, $category: String, $recipes: [MenuRecipeInput!]) {
  updateMenu(id: $id, title: $title, description: $description, active: $active, category: $category, recipes: $recipes) { id slug }
}`;

function classifyRecipe(recipe: RecipeOption): string {
  return classifyRecipeCourse(recipe.tags);
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
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [menuDbId, setMenuDbId] = useState('');
  const [loading, setLoading] = useState(true);
  const menusBase = `/kitchens/${kitchen}/menus`;
  const slug = kitchen;

  useEffect(() => {
    Promise.all([
      gql<{ recipes: RecipeOption[] }>(RECIPES_QUERY, { kitchenSlug: slug }),
      gql<{ menu: { id: string; slug: string; title: string; description: string | null; category: string | null; recipes: { course: string; recipe: { id: string; title: string } }[] } }>(MENU_QUERY, { id: menuId }),
    ]).then(([r, m]) => {
      setRecipes(r.recipes);
      if (m.menu) {
        setMenuDbId(m.menu.id);
        setTitle(m.menu.title);
        setDescription(m.menu.description ?? '');
        setActive(m.menu.active ?? true);
        setCategory(m.menu.category ?? '');
        setSelected(m.menu.recipes.map((mr) => ({
          recipeId: mr.recipe.id,
          course: mr.course || 'other',
          title: mr.recipe.title,
        })));
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [kitchen, menuId]);

  const grouped: Record<string, RecipeOption[]> = { appetizer: [], breakfast: [], 'main-course': [], side: [], beverage: [], dessert: [], other: [] };
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
    const variables = {
      id: menuDbId,
      title: title.trim(),
      description: description.trim() || null,
      active,
      category: category || null,
      recipes: selected.map((s, i) => ({ recipeId: s.recipeId, course: s.course, sortOrder: i })),
    };
    try {
      await gql(UPDATE_MENU, variables);
    } catch {
      enqueue(UPDATE_MENU, variables);
    }
    window.location.href = `${menusBase}/${menuId}#stage`;
  }

  if (loading) {
    return (
      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
        <div className="animate-pulse">
          <div className="h-8 bg-[var(--color-accent-subtle)] rounded w-1/3 mb-6" />
          <div className="h-10 bg-[var(--color-accent-subtle)] rounded w-full mb-4" />
          <div className="h-20 bg-[var(--color-accent-subtle)] rounded w-full" />
        </div>
      </main>
    );
  }

  return (
    <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
      <a href={`${menusBase}/${menuId}`} className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
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
            className="w-full px-3 py-2 bg-body border border-[var(--color-border-card)] text-sm"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-1" htmlFor="menu-desc">Description</label>
          <textarea
            id="menu-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-body border border-[var(--color-border-card)] text-sm"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-1" htmlFor="menu-category">Category</label>
          <select
            id="menu-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-body border border-[var(--color-border-card)] text-sm"
          >
            <option value="">— None —</option>
            {MENU_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>

        <label className="flex items-center gap-2 mb-6 cursor-pointer">
          <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 accent-accent" />
          <span className="text-sm font-semibold">Active</span>
          <span className="text-xs text-[var(--color-text-secondary)]">— visible to guests when checked</span>
        </label>

        <h2 className="text-xl font-bold mb-4">Select Recipes</h2>

        {['appetizer', 'breakfast', 'main-course', 'side', 'beverage', 'dessert', 'other'].map((course) => {
          const items = grouped[course];
          if (items.length === 0) return null;
          return (
            <fieldset key={course} className="mb-6">
              <legend className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                {COURSE_LABELS[course]}
              </legend>
              <div className="space-y-1">
                {items.map((r) => (
                  <label key={r.id} className="flex items-center gap-3 px-3 py-2 hover:bg-[var(--color-accent-subtle)] cursor-pointer transition-colors">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleRecipe(r, course)}
                      className="w-4 h-4 accent-accent"
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
            <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
              Your Menu ({selected.length} {selected.length === 1 ? 'recipe' : 'recipes'})
            </h3>
            <ul className="space-y-1">
              {selected.map((s) => (
                <li key={s.recipeId} className="flex items-center justify-between px-3 py-2 bg-[var(--color-bg-card)]">
                  <span className="text-sm">
                    <span className="font-medium">{s.title}</span>
                    <span className="text-[var(--color-text-secondary)] ml-2">{COURSE_LABELS[s.course]}</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => removeSelected(s.recipeId)}
                    className="text-[var(--color-text-secondary)] hover:text-red-500 text-sm"
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
