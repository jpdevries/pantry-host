import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { MENU_CATEGORIES, classifyRecipeCourse, COURSE_LABELS } from '@pantry-host/shared/constants';

interface Recipe {
  id: string;
  slug: string;
  title: string;
  tags: string[];
}

interface MenuRecipe {
  id: string;
  course: string | null;
  sortOrder: number;
  recipe: { id: string; title: string };
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
    recipes { id course sortOrder recipe { id title } }
  }
}`;

const RECIPES_QUERY = `{ recipes { id slug title tags } }`;

const UPDATE_MUTATION = `mutation(
  $id: String!, $title: String, $description: String, $active: Boolean, $category: String,
  $recipes: [MenuRecipeInput!]
) {
  updateMenu(
    id: $id, title: $title, description: $description, active: $active, category: $category,
    recipes: $recipes
  ) { id slug }
}`;

export default function MenuEditPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [allRecipes, setAllRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [active, setActive] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!slug) return;
    Promise.all([
      gql<{ menu: Menu | null }>(MENU_QUERY, { id: slug }),
      gql<{ recipes: Recipe[] }>(RECIPES_QUERY),
    ]).then(([menuData, recipesData]) => {
      const m = menuData.menu;
      if (m) {
        setMenu(m);
        setTitle(m.title);
        setDescription(m.description ?? '');
        setCategory(m.category ?? '');
        setActive(m.active);
        setSelected(new Set(m.recipes.map((mr) => mr.recipe.id)));
      }
      setAllRecipes(recipesData.recipes);
    }).catch(console.error).finally(() => setLoading(false));
  }, [slug]);

  function toggleRecipe(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  // Group all recipes by inferred course
  const grouped: Record<string, Recipe[]> = {};
  for (const r of allRecipes) {
    const course = classifyRecipeCourse(r.tags) || 'other';
    (grouped[course] ??= []).push(r);
  }
  const courseOrder = ['appetizer', 'breakfast', 'main-course', 'side', 'beverage', 'dessert', 'other'];
  const sortedCourses = Object.keys(grouped).sort((a, b) => {
    const ai = courseOrder.indexOf(a);
    const bi = courseOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!menu || !title.trim()) return;
    setSaving(true);

    const menuRecipes = Array.from(selected).map((recipeId, i) => {
      const r = allRecipes.find((r) => r.id === recipeId);
      return {
        recipeId,
        course: r ? classifyRecipeCourse(r.tags) || 'other' : 'other',
        sortOrder: i,
      };
    });

    try {
      const { updateMenu } = await gql<{ updateMenu: { slug: string } }>(UPDATE_MUTATION, {
        id: menu.id,
        title: title.trim(),
        description: description.trim() || null,
        active,
        category: category || null,
        recipes: menuRecipes,
      });
      navigate(`/menus/${updateMenu.slug}#stage`);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  if (loading) return <div className="h-40 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />;
  if (!menu) return <p className="text-[var(--color-text-secondary)]">Menu not found.</p>;

  return (
    <div>
      <Link to={`/menus/${slug}`} className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
        &larr; Back to menu
      </Link>

      <h1 className="text-3xl font-bold mb-6">Edit Menu</h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="field-label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="field-input w-full"
          />
        </div>

        <div>
          <label className="field-label">Description</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="field-input w-full"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="field-label">Category</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} className="field-select w-full">
              <option value="">None</option>
              {MENU_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end pb-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4" />
              <span className="text-sm">Active</span>
            </label>
          </div>
        </div>

        {/* Recipe selection */}
        <fieldset>
          <legend className="field-label mb-3">
            Recipes <span className="font-normal text-[var(--color-text-secondary)]">({selected.size} selected)</span>
          </legend>
          {allRecipes.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No recipes yet.</p>
          ) : (
            <div className="space-y-4">
              {sortedCourses.map((course) => (
                <div key={course}>
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                    {COURSE_LABELS[course] || course}
                  </h3>
                  <div className="space-y-1">
                    {grouped[course].map((r) => (
                      <label key={r.id} className="flex items-center gap-2 py-1.5 px-2 rounded cursor-pointer hover:bg-[var(--color-accent-subtle)]">
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleRecipe(r.id)}
                          className="w-4 h-4"
                        />
                        <span className="text-sm">{r.title}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </fieldset>

        <div className="flex gap-3">
          <button type="submit" disabled={saving || !title.trim()} className="btn-primary disabled:opacity-50">
            {saving ? 'Saving\u2026' : 'Save Changes'}
          </button>
          <Link to={`/menus/${slug}`} className="btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
