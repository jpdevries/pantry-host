import Head from 'next/head';
import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import { cacheSet, cacheGet } from '@pantry-host/shared/cache';
import { enqueue } from '@/lib/offlineQueue';
import { groupIngredients } from '@pantry-host/shared/ingredient-groups';
import { ShoppingCart, Basket, MapPin } from '@phosphor-icons/react';

/** Convert a kebab-case tag to Title Case display: "farmers-market" → "Farmers Market" */
function tagToTitle(tag: string): string {
  return tag.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

interface RecipeIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
}

interface QueuedRecipe {
  id: string;
  slug: string | null;
  title: string;
  groceryIngredients: RecipeIngredient[];
}

interface PantryItem {
  id: string;
  name: string;
  quantity: number | null;
  unit: string | null;
  alwaysOnHand: boolean;
  tags: string[];
}

type ItemStatus = 'buy' | 'need_more' | 'check_pantry' | 'have';

interface PerRecipeItem {
  key: string;
  ingredientName: string;
  unit: string | null;
  quantity: number | null;
  status: ItemStatus;
  pantryQuantity: number | null;
  stores: string[];
}

const TOGGLE_QUEUED = `mutation ToggleQueued($id: String!) { toggleRecipeQueued(id: $id) { id queued } }`;

const QUEUED_RECIPES_QUERY = `
  query QueuedRecipes($kitchenSlug: String) {
    recipes(queued: true, kitchenSlug: $kitchenSlug) {
      id slug title
      groceryIngredients { ingredientName quantity unit }
    }
  }
`;

const INGREDIENTS_QUERY = `
  query Ingredients($kitchenSlug: String) {
    ingredients(kitchenSlug: $kitchenSlug) { id name quantity unit alwaysOnHand tags }
  }
`;

function resolveStatus(ing: RecipeIngredient, pantryByName: Map<string, PantryItem>): { status: ItemStatus; pantryQuantity: number | null } {
  const pantryItem = pantryByName.get(ing.ingredientName.toLowerCase());
  if (!pantryItem) return { status: 'buy', pantryQuantity: null };
  if (pantryItem.alwaysOnHand) return { status: 'have', pantryQuantity: null };

  const pantryQuantity = pantryItem.quantity;
  if (pantryQuantity == null || ing.quantity == null) return { status: 'check_pantry', pantryQuantity };
  if (pantryItem.unit != null && ing.unit != null && pantryItem.unit !== ing.unit) return { status: 'check_pantry', pantryQuantity };
  if (pantryQuantity >= ing.quantity) return { status: 'have', pantryQuantity };
  return { status: 'need_more', pantryQuantity };
}

function buildPerRecipeItems(recipe: QueuedRecipe, pantryByName: Map<string, PantryItem>, harvestLocations: string[] = []): PerRecipeItem[] {
  return recipe.groceryIngredients
    .map((ing) => {
      const { status, pantryQuantity } = resolveStatus(ing, pantryByName);
      const pantryItem = pantryByName.get(ing.ingredientName.toLowerCase());
      const stores = harvestLocations.filter((loc) => pantryItem?.tags.includes(loc));
      return {
        key: `${recipe.id}::${ing.ingredientName.toLowerCase()}`,
        ingredientName: ing.ingredientName,
        unit: ing.unit,
        quantity: ing.quantity,
        status,
        pantryQuantity,
        stores,
      };
    })
    .sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
}

function fmtQty(qty: number | null, unit: string | null): string {
  if (qty == null) return unit ?? '';
  const n = Math.round(qty * 100) / 100;
  return unit ? `${n} ${unit}` : `${n}`;
}

interface Props { kitchen: string; }

export default function GroceryListPage({ kitchen }: Props) {
  const [recipes, setRecipes] = useState<QueuedRecipe[]>([]);
  const [pantry, setPantry] = useState<PantryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingCommon, setAddingCommon] = useState(false);
  const [hasCommon, setHasCommon] = useState(false);
  const [commonItems, setCommonItems] = useState<string[]>(() => {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem('groceryCommonItems');
      return raw ? (JSON.parse(raw) as string[]) : [];
    } catch { return []; }
  });
  const [checked, setChecked] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set();
    try {
      const raw = localStorage.getItem('groceryChecked');
      return raw ? new Set<string>(JSON.parse(raw) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const [harvestLocations, setHarvestLocations] = useState<string[]>([]);

  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  const cacheKey = `cache:groceryList:${kitchen}`;

  // Read harvest locations from server settings (shared across household)
  useEffect(() => {
    fetch('/api/settings-read')
      .then((r) => r.ok ? r.json() : null)
      .then((j: { values?: Record<string, string | null> } | null) => {
        const raw = j?.values?.HARVEST_LOCATIONS;
        if (raw) setHarvestLocations(raw.split(',').map((s) => s.trim()).filter(Boolean));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      gql<{ recipes: QueuedRecipe[] }>(QUEUED_RECIPES_QUERY, { kitchenSlug: kitchen }),
      gql<{ ingredients: PantryItem[] }>(INGREDIENTS_QUERY, { kitchenSlug: kitchen }),
    ])
      .then(([rd, id]) => {
        setRecipes(rd.recipes);
        setPantry(id.ingredients);
        setHasCommon(id.ingredients.some((i) => i.tags?.some((t) => t.toLowerCase() === 'common')));
        cacheSet(cacheKey, { recipes: rd.recipes, pantry: id.ingredients });
      })
      .catch(() => {
        const cached = cacheGet<{ recipes: QueuedRecipe[]; pantry: PantryItem[] }>(cacheKey);
        if (cached) { setRecipes(cached.recipes); setPantry(cached.pantry); }
      })
      .finally(() => setLoading(false));
  }, [kitchen]);

  async function handleAddCommon() {
    setAddingCommon(true);
    try {
      const data = await gql<{ ingredients: { name: string }[] }>(
        `query CommonIngredients($kitchenSlug: String) { ingredients(kitchenSlug: $kitchenSlug) { name tags } }`,
        { kitchenSlug: kitchen }
      );
      const common = (data.ingredients as any[])
        .filter((i) => i.tags?.some((t: string) => t.toLowerCase() === 'common'))
        .map((i) => i.name);
      setCommonItems(common);
      try { localStorage.setItem('groceryCommonItems', JSON.stringify(common)); } catch { /* ignore */ }
    } catch { /* ignore */ }
    setAddingCommon(false);
  }

  function clearCommon() {
    setCommonItems([]);
    try { localStorage.removeItem('groceryCommonItems'); } catch { /* ignore */ }
  }

  async function handleDequeue(recipeId: string) {
    setRecipes((prev) => prev.filter((r) => r.id !== recipeId));
    try {
      await gql(TOGGLE_QUEUED, { id: recipeId });
    } catch {
      enqueue(TOGGLE_QUEUED, { id: recipeId });
    }
  }

  function toggleChecked(key: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      try { localStorage.setItem('groceryChecked', JSON.stringify([...next])); } catch { /* ignore */ }
      return next;
    });
  }

  const pantryByName = new Map<string, PantryItem>();
  for (const item of pantry) {
    const key = item.name.toLowerCase();
    const existing = pantryByName.get(key);
    if (existing) {
      // Merge tags from duplicate entries
      const merged = new Set([...existing.tags, ...item.tags]);
      pantryByName.set(key, { ...existing, tags: [...merged] });
    } else {
      pantryByName.set(key, item);
    }
  }

  const sortedRecipes = [...recipes].sort((a, b) => a.title.localeCompare(b.title));

  return (
    <>
      <Head><title>List — Pantry Host</title></Head>
      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-2xl mx-auto">
        <h1 className="text-4xl font-bold mb-8">Grocery List</h1>

        {/* Cooking queue chips */}
        <section aria-labelledby="queue-heading" className="mb-10">
          <h2 id="queue-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
            Cooking Queue
          </h2>
          {loading ? (
            <p className="text-[var(--color-text-secondary)]" aria-busy="true">Loading…</p>
          ) : recipes.length === 0 ? (
            <div>
              <p className="text-[var(--color-text-secondary)] mb-4">
                No recipes queued. Add recipes to your cooking queue and their ingredients will appear here as a grocery list.
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`${recipesBase}#stage`}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-accent text-[var(--color-bg-body)] hover:bg-accent-hover transition-colors rounded"
                >
                  <ShoppingCart size={16} aria-hidden />
                  Add from Recipes
                </a>
                {hasCommon && (
                  <button
                    type="button"
                    onClick={handleAddCommon}
                    disabled={addingCommon}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[var(--color-border-card)] text-[var(--color-text-secondary)] hover:border-accent hover:text-accent transition-colors rounded"
                  >
                    <Basket size={16} aria-hidden />
                    {addingCommon ? 'Adding…' : 'Add Common Ingredients'}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <ul role="list" className="flex flex-wrap gap-2" aria-label="Queued recipes">
              {recipes.map((r) => (
                <li key={r.id} className="flex items-center gap-1 bg-accent-subtle text-accent px-3 py-1 text-sm font-medium">
                  <a href={`${recipesBase}/${r.slug ?? r.id}#stage`} className="hover:underline">{r.title}</a>
                  <button
                    type="button"
                    onClick={() => handleDequeue(r.id)}
                    aria-label={`Remove ${r.title} from queue`}
                    className="ml-1 leading-none text-base hover:text-accent transition-colors"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Common ingredients checklist */}
        {commonItems.length > 0 && (
          <section aria-labelledby="common-heading" className="mb-10">
            <div className="flex items-center justify-between mb-3">
              <h2 id="common-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                Common Ingredients
              </h2>
              <button
                type="button"
                onClick={clearCommon}
                className="text-xs text-[var(--color-text-secondary)] hover:underline"
              >
                Clear
              </button>
            </div>
            <ul role="list" className="space-y-2">
              {commonItems.map((name) => {
                const key = `common::${name.toLowerCase()}`;
                const isChecked = checked.has(key);
                return (
                  <li key={key}>
                    <label className={`flex items-start gap-3 cursor-pointer ${isChecked ? 'opacity-50' : ''}`}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleChecked(key)}
                        className="mt-0.5 w-5 h-5 border-2 border-[var(--color-border-card)] accent-accent shrink-0"
                      />
                      <span className={`flex-1 leading-snug font-medium ${isChecked ? 'line-through text-[var(--color-text-secondary)]' : ''}`}>
                        {name}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        {/* Grocery list — grouped by harvest location → recipe */}
        {!loading && sortedRecipes.length > 0 && (() => {
          // Build all items with store tags
          const allRecipeItems = sortedRecipes.map((recipe) => ({
            recipe,
            items: buildPerRecipeItems(recipe, pantryByName, harvestLocations),
          }));

          // Group by store if harvest locations are configured
          const hasStoreGrouping = harvestLocations.length > 0 && allRecipeItems.some(({ items }) => items.some((i) => i.stores.length > 0));

          type StoreGroup = { store: string | null; entries: { recipe: QueuedRecipe; items: PerRecipeItem[] }[] };
          const storeGroups: StoreGroup[] = [];

          if (hasStoreGrouping) {
            // Build store → recipe → items map
            const storeMap = new Map<string, Map<string, PerRecipeItem[]>>();
            const untaggedMap = new Map<string, PerRecipeItem[]>();

            for (const { recipe, items } of allRecipeItems) {
              for (const item of items) {
                if (item.stores.length === 0) {
                  // Untagged
                  if (!untaggedMap.has(recipe.id)) untaggedMap.set(recipe.id, []);
                  untaggedMap.get(recipe.id)!.push(item);
                } else {
                  for (const store of item.stores) {
                    if (!storeMap.has(store)) storeMap.set(store, new Map());
                    const recipeMap = storeMap.get(store)!;
                    if (!recipeMap.has(recipe.id)) recipeMap.set(recipe.id, []);
                    recipeMap.get(recipe.id)!.push(item);
                  }
                }
              }
            }

            // Sorted store groups
            for (const store of [...storeMap.keys()].sort()) {
              const recipeMap = storeMap.get(store)!;
              const entries = sortedRecipes
                .filter((r) => recipeMap.has(r.id))
                .map((r) => ({ recipe: r, items: recipeMap.get(r.id)! }));
              storeGroups.push({ store, entries });
            }
            // Untagged at the end (no store wrapper)
            const untaggedEntries = sortedRecipes
              .filter((r) => untaggedMap.has(r.id))
              .map((r) => ({ recipe: r, items: untaggedMap.get(r.id)! }));
            if (untaggedEntries.length > 0) {
              storeGroups.push({ store: null, entries: untaggedEntries });
            }
          } else {
            // No store grouping — flat recipe list
            storeGroups.push({ store: null, entries: allRecipeItems.filter(({ items }) => items.length > 0) });
          }

          return (
          <section aria-labelledby="grocery-heading">
            <h2 id="grocery-heading" className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-4">
              Ingredients
            </h2>

            <div className="space-y-6 grocery-item">
              {storeGroups.map((sg) => {
                const recipeFieldsets = sg.entries.map(({ recipe, items }) => {
                if (items.length === 0) return null;

                return (
                  <fieldset key={recipe.id} className="border border-[var(--color-border-card)] rounded-lg p-4">
                    <legend className="px-2 font-semibold text-sm">
                      <a href={`${recipesBase}/${recipe.slug ?? recipe.id}#stage`} className="hover:underline">
                        {recipe.title}
                      </a>
                    </legend>

                    <div className="space-y-3">
                      {groupIngredients(items).map((g, gi) => {
                        const sorted = [...g.items].sort((a, b) => a.ingredientName.localeCompare(b.ingredientName));
                        const renderItem = (item: typeof items[0] & { index: number }) => {
                          const itemKey = items[item.index]?.key ?? `${item.ingredientName.toLowerCase()}`;
                          const isChecked = checked.has(itemKey);
                          const isHave = item.status === 'have';
                          return (
                            <li key={itemKey}>
                              <label className={`flex items-start gap-3 cursor-pointer ${isChecked || isHave ? 'opacity-50' : ''}`}>
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={() => toggleChecked(itemKey)}
                                  className="mt-0.5 w-5 h-5 border-2 border-[var(--color-border-card)] accent-accent shrink-0"
                                />
                                <span className={`flex-1 leading-snug ${isChecked ? 'line-through text-[var(--color-text-secondary)]' : ''}`}>
                                  <span className="font-medium">
                                    {fmtQty(item.quantity, item.unit)} {item.ingredientName}
                                  </span>
                                  {item.status === 'need_more' && item.pantryQuantity != null && (
                                    <span className="ml-2 text-xs text-[var(--color-text-secondary)]">(have {fmtQty(item.pantryQuantity, item.unit)})</span>
                                  )}
                                  {item.status === 'check_pantry' && (
                                    <span className="ml-2 text-xs text-accent">check pantry</span>
                                  )}
                                  {isHave && !isChecked && (
                                    <span className="ml-2 text-xs text-[var(--color-text-secondary)]">✓ in pantry</span>
                                  )}
                                </span>
                              </label>
                            </li>
                          );
                        };
                        const list = <ul role="list" className="space-y-2">{sorted.map((item) => renderItem(item as any))}</ul>;
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
                });

                if (sg.store) {
                  return (
                    <fieldset key={`store-${sg.store}`} className="border-2 border-[var(--color-accent-subtle)] rounded-xl p-4">
                      <legend className="px-2 font-semibold text-sm flex items-center gap-1.5">
                        <MapPin size={14} weight="bold" aria-hidden /> {tagToTitle(sg.store)}
                      </legend>
                      <div className="space-y-4">{recipeFieldsets}</div>
                    </fieldset>
                  );
                }
                // Untagged — render recipe fieldsets directly (no store wrapper)
                return <div key="untagged" className="space-y-6">{recipeFieldsets}</div>;
              })}
            </div>
          </section>
          );
        })()}
      </main>
    </>
  );
}
