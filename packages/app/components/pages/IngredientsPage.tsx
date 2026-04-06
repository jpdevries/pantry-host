import Head from 'next/head';
import { useState, useEffect, useCallback, useMemo } from 'react';
import IngredientForm from '@/components/IngredientForm';
import BatchScanSession from '@/components/BatchScanSession';
import { gql } from '@/lib/gql';
import {
  Camera, PencilSimple, Trash,
  Leaf, Bone, Egg, Package, Snowflake, DotsThree,
  Carrot, OrangeSlice, Plant, Cow, Drop, Knife, Fish,
  Cube, Grains, Acorn, Jar, JarLabel, Pepper, Bread,
  ForkKnife, Coffee, Cookie,
} from '@phosphor-icons/react';
import type { ReactNode } from 'react';

const GROUP_ICONS: Record<string, ReactNode> = {
  'Fresh': <Leaf size={20} aria-hidden />,
  'Protein': <Bone size={20} aria-hidden />,
  'Shelf Stable': <Package size={20} aria-hidden />,
  'Cold & Frozen': <Snowflake size={20} aria-hidden />,
  'Other': <DotsThree size={20} aria-hidden />,
};

const CAT_ICONS: Record<string, ReactNode> = {
  'vegetables': <Carrot size={16} aria-hidden />,
  'fruit': <OrangeSlice size={16} aria-hidden />,
  'fresh herbs': <Plant size={16} aria-hidden />,
  'dairy': <Cow size={16} aria-hidden />,
  'meat & poultry': <Knife size={16} aria-hidden />,
  'seafood & fish': <Fish size={16} aria-hidden />,
  'eggs': <Egg size={16} aria-hidden />,
  'tofu & tempeh': <Cube size={16} aria-hidden />,
  'legumes & pulses': <Grains size={16} aria-hidden />,
  'nuts & seeds': <Acorn size={16} aria-hidden />,
  'plant-based milks': <Drop size={16} aria-hidden />,
  'dry goods & grains': <Grains size={16} aria-hidden />,
  'canned & jarred': <Jar size={16} aria-hidden />,
  'condiments & sauces': <JarLabel size={16} aria-hidden />,
  'herbs & spices': <Pepper size={16} aria-hidden />,
  'oils & vinegars': <Drop size={16} aria-hidden />,
  'baking': <Bread size={16} aria-hidden />,
  'frozen': <Snowflake size={16} aria-hidden />,
  'deli & charcuterie': <ForkKnife size={16} aria-hidden />,
  'beverages': <Coffee size={16} aria-hidden />,
  'snacks': <Cookie size={16} aria-hidden />,
  'other': <Package size={16} aria-hidden />,
};
import { cacheSet, cacheGet } from '@pantry-host/shared/cache';
import { HIDDEN_TAGS, CATEGORY_GROUPS } from '@pantry-host/shared/constants';
import { isOwner } from '@/lib/isTrustedNetwork';

interface Ingredient {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  alwaysOnHand: boolean;
  tags: string[];
}

const INGREDIENTS_QUERY = `
  query Ingredients($kitchenSlug: String) {
    ingredients(kitchenSlug: $kitchenSlug) { id name category quantity unit alwaysOnHand tags }
  }
`;

const DELETE_INGREDIENT = `
  mutation DeleteIngredient($id: String!) {
    deleteIngredient(id: $id)
  }
`;

interface Props { kitchen: string; }

export default function IngredientsPage({ kitchen }: Props) {
  const cacheKey = `cache:ingredients:${kitchen}`;
  const cached = cacheGet<Ingredient[]>(cacheKey);

  const [ingredients, setIngredients] = useState<Ingredient[]>(cached ?? []);
  const [loaded, setLoaded] = useState(Boolean(cached));
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showBatchScan, setShowBatchScan] = useState(false);
  const [isSecure, setIsSecure] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    try {
      const data = await gql<{ ingredients: Ingredient[] }>(INGREDIENTS_QUERY, { kitchenSlug: kitchen });
      setIngredients(data.ingredients);
      setLoaded(true);
      cacheSet(cacheKey, data.ingredients);
    } catch {
      if (!loaded && cached) setIngredients(cached);
      setLoaded(true);
    }
  }

  useEffect(() => { refresh(); }, [kitchen]);
  useEffect(() => {
    setIsSecure(isOwner());
  }, []);

  // Scroll to hash target after data renders (browser can't scroll to #cat-* if it didn't exist on first paint)
  useEffect(() => {
    if (!loaded) return;
    const hash = window.location.hash;
    if (!hash) return;
    requestAnimationFrame(() => {
      const el = document.querySelector(hash);
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  }, [loaded]);

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await gql(DELETE_INGREDIENT, { id });
      await refresh();
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  }

  const handleBatchComplete = useCallback(async () => {
    setShowBatchScan(false);
    await refresh();
  }, [kitchen]);

  const allTags = [...new Set(ingredients.flatMap((i) => i.tags))].sort();

  const [filter, setFilter] = useState('');

  const filterSuggestions = useMemo(() => {
    const names = ingredients.map((i) => i.name);
    const tags = allTags.map((t) => `#${t}`);
    return [...names, ...tags];
  }, [ingredients, allTags]);

  const filtered = useMemo(() => {
    if (!filter.trim()) return ingredients;
    const q = filter.toLowerCase().replace(/^#/, '');
    return ingredients.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q))
    );
  }, [ingredients, filter]);

  const grouped = groupBy(filtered, (i) => i.category ?? 'other');

  return (
    <>
      <Head>
        <title>Pantry — Pantry Host</title>
      </Head>

      {showBatchScan && (
        <BatchScanSession
          onComplete={handleBatchComplete}
          onCancel={() => setShowBatchScan(false)}
        />
      )}

      <datalist id="existing-tags">
        {allTags.map((t) => <option key={t} value={t} />)}
      </datalist>

      {Object.keys(grouped).length > 1 && (
        <nav aria-label="Pantry categories" className="sticky top-0 z-10 bg-body-translucent backdrop-blur pt-4 pb-2 overflow-x-auto overflow-y-hidden">
          <ul className="flex gap-2 whitespace-nowrap pb-1 px-4 md:px-8" role="list">
            {CATEGORY_GROUPS.flatMap((g) => g.categories).filter((cat) => grouped[cat]).map((cat) => (
              <li key={cat}>
                <a
                  href={`#cat-${cat}`}
                  onClick={(e) => {
                    const el = document.getElementById(`cat-${cat}`);
                    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', `#cat-${cat}`); }
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-full border border-[var(--color-border-card)] text-[var(--color-text-secondary)] hover:text-accent hover:border-accent transition-colors whitespace-nowrap"
                >
                  {CAT_ICONS[cat]} {cat} <span className="tabular-nums text-[var(--color-text-secondary)]">{grouped[cat].length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-4xl font-bold">What's in Your Pantry?</h1>
          <div className="flex gap-3 flex-wrap">
            {isSecure && (
              <button type="button" onClick={() => setShowBatchScan(true)} className="btn-secondary" aria-label="Batch scan groceries with camera">
                <Camera size={16} aria-hidden />
                Batch Scan
              </button>
            )}
            {isSecure && (
              <button
                type="button"
                onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}
                className="btn-primary"
                aria-expanded={showAddForm}
                aria-controls="add-ingredient-form"
              >
                {showAddForm ? 'Cancel' : '+ Add Item'}
              </button>
            )}
          </div>
        </div>

        {showAddForm && (
          <section id="add-ingredient-form" aria-label="Add ingredient" className="mb-8 p-6 border border-[var(--color-border-card)] bg-[var(--color-bg-card)]">
            <h2 className="text-lg font-bold mb-4">Add Ingredient</h2>
            <IngredientForm
              kitchenSlug={kitchen}
              onSave={async () => { setShowAddForm(false); await refresh(); }}
              onCancel={() => setShowAddForm(false)}
            />
          </section>
        )}

        {ingredients.length > 0 && (
          <div className="mb-8">
            <label htmlFor="pantry-filter" className="field-label">Filter Ingredients</label>
            <input
              id="pantry-filter"
              type="text"
              list="pantry-filter-suggestions"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="garlic, #organic, dairy"
              className="field-input w-full"
            />
            <datalist id="pantry-filter-suggestions">
              {filterSuggestions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>
        )}

        {!loaded && ingredients.length === 0 && (
          <div className="space-y-10">
            {[1, 2, 3].map((i) => (
              <section key={i} className="animate-pulse">
                <div className="h-3 w-20 bg-[var(--color-accent-subtle)] rounded mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-5 bg-[var(--color-bg-card)] rounded w-full" />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {loaded && ingredients.length === 0 && (
          <div className="text-center py-20 text-[var(--color-text-secondary)]">
            <p className="text-lg mb-4">Your pantry is empty.</p>
            <p>Scan groceries or add items manually to get started.</p>
          </div>
        )}

        {CATEGORY_GROUPS.filter((g) => g.categories.some((c) => grouped[c])).map((group) => (
          <section key={group.label} className="mb-10">
            <h2 className="text-lg font-bold mb-3 scroll-mt-20 flex items-center gap-2">{GROUP_ICONS[group.label]} {group.label}</h2>
            {group.categories.filter((c) => grouped[c]).map((category) => (
              <div key={category} className="mb-4 ml-1" id={`cat-${category}`}>
                <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--color-text-secondary)] mb-2 scroll-mt-20 flex items-center gap-1.5">
                  {CAT_ICONS[category]} {category}
                </h3>
            <ul role="list" className="divide-y divide-[var(--color-border-card)]">
              {grouped[category].map((ing) => (
                <li key={ing.id}>
                  {editingId === ing.id ? (
                    <div className="py-4 px-2 bg-[var(--color-bg-card)]">
                      <IngredientForm
                        ingredient={ing}
                        kitchenSlug={kitchen}
                        onSave={async () => { setEditingId(null); await refresh(); }}
                        onCancel={() => setEditingId(null)}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <span className="font-medium" id={`ing-${ing.id}`}>{ing.name}</span>
                        {ing.alwaysOnHand ? (
                          <span className="ml-2 text-xs font-medium text-accent">always on hand</span>
                        ) : (ing.quantity != null || ing.unit) && (
                          <span className="ml-2 text-sm text-[var(--color-text-secondary)]">
                            {ing.quantity != null ? ing.quantity : ''} {ing.unit ?? ''}
                          </span>
                        )}
                        {ing.tags.filter((t) => !HIDDEN_TAGS.has(t.toLowerCase())).length > 0 && (
                          <span className="ml-2">
                            {ing.tags.filter((t) => !HIDDEN_TAGS.has(t.toLowerCase())).map((t) => <span key={t} className="tag mr-1">{t}</span>)}
                          </span>
                        )}
                      </div>
                      {isSecure && (
                        <div className="flex gap-2 shrink-0">
                          <button type="button" onClick={() => setEditingId(ing.id)} aria-label="Edit" aria-describedby={`ing-${ing.id}`} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-2">
                            <PencilSimple size={16} aria-hidden />
                          </button>
                          {deleteConfirm === ing.id ? (
                            <div className="flex gap-1 items-center">
                              <span className="text-xs text-[var(--color-text-secondary)] mr-1">Delete?</span>
                              <button type="button" autoFocus onClick={() => handleDelete(ing.id)} disabled={deleting} aria-label="Confirm delete" aria-describedby={`ing-${ing.id}`} className="text-xs btn-danger px-2 py-1">Yes</button>
                              <button type="button" onClick={() => setDeleteConfirm(null)} aria-label="Cancel delete" aria-describedby={`ing-${ing.id}`} className="text-xs btn-secondary px-2 py-1">No</button>
                            </div>
                          ) : (
                            <button type="button" onClick={() => setDeleteConfirm(ing.id)} aria-label="Delete" aria-describedby={`ing-${ing.id}`} className="text-[var(--color-text-secondary)] hover:text-red-500 p-2">
                              <Trash size={16} aria-hidden />
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
              </div>
            ))}
          </section>
        ))}
      </main>
    </>
  );
}

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce<Record<string, T[]>>((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {});
}

