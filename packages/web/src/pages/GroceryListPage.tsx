import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { groupIngredients } from '@pantry-host/shared/ingredient-groups';
import { MapPin } from '@phosphor-icons/react';

/** Convert a kebab-case tag to Title Case display: "farmers-market" → "Farmers Market" */
function tagToTitle(tag: string): string {
  return tag.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
import { useKitchen } from '../hooks/useKitchen';

interface RecipeIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
}

interface Recipe {
  id: string;
  slug: string;
  title: string;
  groceryIngredients: RecipeIngredient[];
}

interface PantryItem {
  name: string;
  tags: string[];
}

const QUERY = `query($kitchenSlug:String){ recipes(queued: true, kitchenSlug:$kitchenSlug) { id slug title groceryIngredients { ingredientName quantity unit } } }`;
const PANTRY_QUERY = `query($kitchenSlug:String){ ingredients(kitchenSlug:$kitchenSlug) { name tags } }`;
const TOGGLE_QUEUED = `mutation($id: String!) { toggleRecipeQueued(id: $id) { id queued } }`;

const STORAGE_KEY = 'groceryChecked';

function loadChecked(): Set<string> {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? new Set(JSON.parse(stored)) : new Set();
  } catch { return new Set(); }
}

function saveChecked(checked: Set<string>) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify([...checked]));
}

function storageKeyFor(key: string): string {
  return key.toLowerCase().replace(/_/g, '-');
}

export default function GroceryListPage() {
  const kitchen = useKitchen();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [pantryByName, setPantryByName] = useState<Map<string, PantryItem>>(new Map());
  const [checked, setChecked] = useState<Set<string>>(() => loadChecked());
  const [loading, setLoading] = useState(true);

  // Read harvest locations from localStorage
  const [harvestLocations] = useState<string[]>(() => {
    const raw = localStorage.getItem(storageKeyFor('HARVEST_LOCATIONS'));
    return raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : [];
  });

  async function load() {
    try {
      const [rd, pd] = await Promise.all([
        gql<{ recipes: Recipe[] }>(QUERY, { kitchenSlug: kitchen }),
        gql<{ ingredients: PantryItem[] }>(PANTRY_QUERY, { kitchenSlug: kitchen }),
      ]);
      setRecipes(rd.recipes);
      const map = new Map<string, PantryItem>();
      for (const item of pd.ingredients) map.set(item.name.toLowerCase(), item);
      setPantryByName(map);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  function toggle(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      saveChecked(next);
      return next;
    });
  }

  async function dequeue(id: string) {
    await gql(TOGGLE_QUEUED, { id });
    load();
  }

  function getStores(ingredientName: string): string[] {
    if (harvestLocations.length === 0) return [];
    const pantryItem = pantryByName.get(ingredientName.toLowerCase());
    if (!pantryItem) return [];
    return harvestLocations.filter((loc) => pantryItem.tags.includes(loc));
  }

  const totalIngredients = new Set(
    recipes.flatMap((r) => r.groceryIngredients.map((i) => i.ingredientName.toLowerCase()))
  ).size;

  const sortedRecipes = [...recipes].sort((a, b) => a.title.localeCompare(b.title));

  // Build store groups
  const hasStoreGrouping = harvestLocations.length > 0 && sortedRecipes.some((r) =>
    r.groceryIngredients.some((i) => getStores(i.ingredientName).length > 0)
  );

  type StoreGroup = { store: string | null; entries: { recipe: Recipe; ingredients: RecipeIngredient[] }[] };
  const storeGroups: StoreGroup[] = [];

  if (hasStoreGrouping) {
    const storeMap = new Map<string, Map<string, RecipeIngredient[]>>();
    const untaggedMap = new Map<string, RecipeIngredient[]>();

    for (const recipe of sortedRecipes) {
      for (const ing of recipe.groceryIngredients) {
        const stores = getStores(ing.ingredientName);
        if (stores.length === 0) {
          if (!untaggedMap.has(recipe.id)) untaggedMap.set(recipe.id, []);
          untaggedMap.get(recipe.id)!.push(ing);
        } else {
          for (const store of stores) {
            if (!storeMap.has(store)) storeMap.set(store, new Map());
            const rm = storeMap.get(store)!;
            if (!rm.has(recipe.id)) rm.set(recipe.id, []);
            rm.get(recipe.id)!.push(ing);
          }
        }
      }
    }

    for (const store of [...storeMap.keys()].sort()) {
      const rm = storeMap.get(store)!;
      storeGroups.push({
        store,
        entries: sortedRecipes.filter((r) => rm.has(r.id)).map((r) => ({ recipe: r, ingredients: rm.get(r.id)! })),
      });
    }
    const untaggedEntries = sortedRecipes
      .filter((r) => untaggedMap.has(r.id))
      .map((r) => ({ recipe: r, ingredients: untaggedMap.get(r.id)! }));
    if (untaggedEntries.length > 0) {
      storeGroups.push({ store: null, entries: untaggedEntries });
    }
  } else {
    storeGroups.push({
      store: null,
      entries: sortedRecipes.map((r) => ({ recipe: r, ingredients: r.groceryIngredients })),
    });
  }

  function renderRecipeFieldset(recipe: Recipe, ingredients: RecipeIngredient[]) {
    return (
      <fieldset key={recipe.id} className="border border-[var(--color-border-card)] rounded-lg p-4">
        <legend className="px-2 font-semibold text-sm">
          <Link to={`/recipes/${recipe.slug}#stage`} className="hover:underline">{recipe.title}</Link>
        </legend>
        <div className="space-y-3">
          {groupIngredients(ingredients).map((g, gi) => {
            const sorted = [...g.items].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
            const list = (
              <ul className="space-y-1">
                {sorted.map((ing) => {
                  const key = `${recipe.id}::${ing.ingredientName.toLowerCase()}`;
                  const isChecked = checked.has(key);
                  return (
                    <li key={key}>
                      <label
                        className={`grocery-item flex items-center gap-3 py-1.5 cursor-pointer select-none transition-opacity ${isChecked ? 'opacity-50 line-through' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggle(key)}
                          className="w-4 h-4 accent-[var(--color-accent)]"
                        />
                        <span className="text-sm">
                          {ing.quantity != null && <span className="font-semibold tabular-nums">{Math.round(ing.quantity * 100) / 100}</span>}
                          {ing.unit && <span className="text-[var(--color-text-secondary)]"> {ing.unit}</span>}
                          {' '}{ing.ingredientName}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            );
            if (!g.group) return <div key={`g-${gi}`}>{list}</div>;
            return (
              <fieldset key={g.group} className="mt-3 first:mt-0">
                <legend className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">{g.group}</legend>
                {list}
              </fieldset>
            );
          })}
        </div>
      </fieldset>
    );
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Grocery List</h1>

      {loading ? (
        <div className="h-40 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />
      ) : recipes.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm">
          No recipes queued. Add recipes to your grocery list from the <Link to="/recipes#stage" className="underline">recipes page</Link>.
        </p>
      ) : (
        <>
          {/* Cooking Queue */}
          <section className="mb-8">
            <h2 className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">Cooking Queue</h2>
            <ul className="flex flex-wrap gap-2" role="list" aria-label="Queued recipes">
              {recipes.map((r) => (
                <li key={r.id} className="flex items-center gap-1 text-[var(--color-accent)] px-3 py-1 text-sm font-medium border border-[var(--color-border-card)]">
                  <Link to={`/recipes/${r.slug}#stage`} className="hover:underline">{r.title}</Link>
                  <button
                    type="button"
                    onClick={() => dequeue(r.id)}
                    aria-label={`Remove ${r.title} from queue`}
                    className="ml-1 leading-none text-base hover:underline"
                  >
                    &times;
                  </button>
                </li>
              ))}
            </ul>
          </section>

          {/* Summary */}
          <p className="text-sm text-[var(--color-text-secondary)] mb-6">
            {recipes.length} recipe{recipes.length !== 1 ? 's' : ''} &middot; {totalIngredients} ingredient{totalIngredients !== 1 ? 's' : ''}
          </p>

          {/* Ingredients grouped by store → recipe */}
          <div className="space-y-6">
            {storeGroups.map((sg) => {
              const fieldsets = sg.entries.map(({ recipe, ingredients }) =>
                renderRecipeFieldset(recipe, ingredients)
              );
              if (sg.store) {
                return (
                  <fieldset key={`store-${sg.store}`} className="border-2 border-[var(--color-accent-subtle)] rounded-xl p-4">
                    <legend className="px-2 font-semibold text-sm flex items-center gap-1.5">
                      <MapPin size={14} weight="bold" aria-hidden /> <code>{sg.store}</code>
                    </legend>
                    <div className="space-y-4">{fieldsets}</div>
                  </fieldset>
                );
              }
              return <div key="untagged" className="space-y-6">{fieldsets}</div>;
            })}
          </div>
        </>
      )}
    </div>
  );
}
