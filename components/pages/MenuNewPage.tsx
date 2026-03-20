import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import { MENU_CATEGORIES } from '@/lib/constants';

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

const CREATE_MENU = `mutation CreateMenu($title: String!, $description: String, $active: Boolean, $category: String, $kitchenSlug: String, $recipes: [MenuRecipeInput!]!) {
  createMenu(title: $title, description: $description, active: $active, category: $category, kitchenSlug: $kitchenSlug, recipes: $recipes) { id slug }
}`;

const COURSE_TAGS: Record<string, string[]> = {
  appetizer: ['appetizer', 'apps', 'starter', 'charcuterie'],
  breakfast: ['breakfast', 'brunch', 'pancakes', 'eggs'],
  'main-course': ['main-course', 'dinner', 'entree', 'lunch'],
  side: ['side', 'sides'],
  beverage: ['beverage', 'drink', 'coffee', 'tea', 'chai', 'smoothies', 'shakes', 'milk', 'creamer', 'mixology'],
  dessert: ['dessert', 'sweets', 'baking'],
};

const COURSE_LABELS: Record<string, string> = {
  appetizer: 'Appetizers',
  breakfast: 'Breakfast',
  'main-course': 'Main Course',
  side: 'Sides',
  beverage: 'Beverages',
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
}

export default function MenuNewPage({ kitchen }: Props) {
  const [recipes, setRecipes] = useState<RecipeOption[]>([]);
  const [selected, setSelected] = useState<SelectedRecipe[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [active, setActive] = useState(true);
  const [category, setCategory] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const menusBase = kitchen === 'home' ? '/menus' : `/kitchens/${kitchen}/menus`;
  const slug = kitchen === 'home' ? undefined : kitchen;

  useEffect(() => {
    gql<{ recipes: RecipeOption[] }>(RECIPES_QUERY, { kitchenSlug: slug })
      .then((d) => setRecipes(d.recipes))
      .catch(console.error);
  }, [kitchen]);

  // Group recipes by course
  const grouped: Record<string, RecipeOption[]> = { appetizer: [], breakfast: [], 'main-course': [], side: [], beverage: [], dessert: [], other: [] };
  for (const r of recipes) {
    const course = classifyRecipe(r);
    grouped[course].push(r);
  }
  // Sort each group alphabetically
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
      const data = await gql<{ createMenu: { id: string; slug: string } }>(CREATE_MENU, {
        title: title.trim(),
        description: description.trim() || null,
        active,
        category: category || null,
        kitchenSlug: slug,
        recipes: selected.map((s, i) => ({ recipeId: s.recipeId, course: s.course, sortOrder: i })),
      });
      window.location.href = `${menusBase}/${data.createMenu.slug}#stage`;
    } catch (err) {
      setError('Failed to create menu');
      setSaving(false);
    }
  }

  return (
    <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
      <a href={menusBase} className="text-sm text-zinc-500 dark:text-zinc-400 hover:underline mb-4 inline-block">
        &larr; Menus
      </a>
      <h1 className="text-3xl font-bold mb-6">New Menu</h1>

      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label className="block text-sm font-semibold mb-1" htmlFor="menu-title">Title</label>
          <input
            id="menu-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Pizza Night, Thanksgiving Dinner"
            className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
            autoFocus
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-1" htmlFor="menu-desc">Description</label>
          <textarea
            id="menu-desc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional description..."
            rows={4}
            className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
          />
        </div>

        <div className="mb-6">
          <label className="block text-sm font-semibold mb-1" htmlFor="menu-category">Category</label>
          <select
            id="menu-category"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full px-3 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm"
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
          <span className="text-xs text-zinc-500 dark:text-zinc-400">— visible to guests when checked</span>
        </label>

        <h2 className="text-xl font-bold mb-4">Select Recipes</h2>

        {['appetizer', 'breakfast', 'main-course', 'side', 'beverage', 'dessert', 'other'].map((course) => {
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
            {saving ? 'Creating...' : 'Create Menu'}
          </button>
          <a href={menusBase} className="btn-secondary">Cancel</a>
        </div>
      </form>
    </main>
  );
}
