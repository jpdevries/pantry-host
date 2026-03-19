import Head from 'next/head';
import { useState, useEffect, useCallback } from 'react';
import IngredientForm from '@/components/IngredientForm';
import BatchScanSession from '@/components/BatchScanSession';
import { gql } from '@/lib/gql';
import { cacheSet, cacheGet } from '@/lib/cache';

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
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    setIsSecure(isDev || window.location.protocol === 'https:');
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

  const grouped = groupBy(ingredients, (i) => i.category ?? 'other');
  const categoryOrder = ['produce', 'fruit', 'dairy', 'protein', 'pantry', 'spices', 'frozen', 'beverages', 'other'];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) => categoryOrder.indexOf(a) - categoryOrder.indexOf(b),
  );

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

      {sortedCategories.length > 1 && (
        <nav aria-label="Pantry categories" className="sticky top-0 z-10 bg-white/90 dark:bg-zinc-950/90 backdrop-blur px-4 md:px-8 max-w-4xl mx-auto pt-4 pb-2 overflow-x-auto overflow-y-hidden">
          <ul className="flex gap-2 whitespace-nowrap pb-1" role="list">
            {sortedCategories.map((cat) => (
              <li key={cat}>
                <a
                  href={`#cat-${cat}`}
                  onClick={(e) => {
                    const el = document.getElementById(`cat-${cat}`);
                    if (el) { e.preventDefault(); el.scrollIntoView({ behavior: 'smooth' }); history.replaceState(null, '', `#cat-${cat}`); }
                  }}
                  className="text-xs font-medium uppercase tracking-wide px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:text-amber-600 dark:hover:text-amber-400 hover:border-amber-400 transition-colors"
                >
                  {cat} <span className="tabular-nums text-zinc-400 dark:text-zinc-500">{grouped[cat].length}</span>
                </a>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-4xl font-bold">Pantry</h1>
          <div className="flex gap-3 flex-wrap">
            {isSecure && (
              <button type="button" onClick={() => setShowBatchScan(true)} className="btn-secondary" aria-label="Batch scan groceries with camera">
                <CameraIcon aria-hidden="true" />
                Batch Scan
              </button>
            )}
            <button
              type="button"
              onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}
              className="btn-primary"
              aria-expanded={showAddForm}
              aria-controls="add-ingredient-form"
            >
              {showAddForm ? 'Cancel' : '+ Add Item'}
            </button>
          </div>
        </div>

        {showAddForm && (
          <section id="add-ingredient-form" aria-label="Add ingredient" className="mb-8 p-6 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
            <h2 className="text-lg font-bold mb-4">Add Ingredient</h2>
            <IngredientForm
              kitchenSlug={kitchen}
              onSave={async () => { setShowAddForm(false); await refresh(); }}
              onCancel={() => setShowAddForm(false)}
            />
          </section>
        )}

        {!loaded && ingredients.length === 0 && (
          <div className="space-y-10">
            {[1, 2, 3].map((i) => (
              <section key={i} className="animate-pulse">
                <div className="h-3 w-20 bg-zinc-200 dark:bg-zinc-700 rounded mb-4" />
                <div className="space-y-3">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className="h-5 bg-zinc-100 dark:bg-zinc-800 rounded w-full" />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        {loaded && ingredients.length === 0 && (
          <div className="text-center py-20 text-zinc-500 dark:text-zinc-400">
            <p className="text-lg mb-4">Your pantry is empty.</p>
            <p>Scan groceries or add items manually to get started.</p>
          </div>
        )}

        {sortedCategories.map((category) => (
          <section key={category} aria-labelledby={`cat-${category}`} className="mb-10">
            <h2 id={`cat-${category}`} className="text-xs font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mb-3 scroll-mt-20">
              {category}
            </h2>
            <ul role="list" className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {grouped[category].map((ing) => (
                <li key={ing.id}>
                  {editingId === ing.id ? (
                    <div className="py-4 px-2 bg-zinc-50 dark:bg-zinc-900">
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
                          <span className="ml-2 text-xs font-medium text-amber-600 dark:text-amber-400">always on hand</span>
                        ) : (ing.quantity != null || ing.unit) && (
                          <span className="ml-2 text-sm text-zinc-500 dark:text-zinc-400">
                            {ing.quantity != null ? ing.quantity : ''} {ing.unit ?? ''}
                          </span>
                        )}
                        {ing.tags.length > 0 && (
                          <span className="ml-2">
                            {ing.tags.map((t) => <span key={t} className="tag mr-1">{t}</span>)}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button type="button" onClick={() => setEditingId(ing.id)} aria-label="Edit" aria-describedby={`ing-${ing.id}`} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-2">
                          <EditIcon aria-hidden="true" />
                        </button>
                        {deleteConfirm === ing.id ? (
                          <div className="flex gap-1 items-center">
                            <span className="text-xs text-zinc-500 mr-1">Delete?</span>
                            <button type="button" autoFocus onClick={() => handleDelete(ing.id)} disabled={deleting} aria-label="Confirm delete" aria-describedby={`ing-${ing.id}`} className="text-xs btn-danger px-2 py-1">Yes</button>
                            <button type="button" onClick={() => setDeleteConfirm(null)} aria-label="Cancel delete" aria-describedby={`ing-${ing.id}`} className="text-xs btn-secondary px-2 py-1">No</button>
                          </div>
                        ) : (
                          <button type="button" onClick={() => setDeleteConfirm(ing.id)} aria-label="Delete" aria-describedby={`ing-${ing.id}`} className="text-zinc-400 hover:text-red-500 p-2">
                            <TrashIcon aria-hidden="true" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ul>
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

function CameraIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>;
}
function EditIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>;
}
function TrashIcon(props: React.SVGProps<SVGSVGElement>) {
  return <svg {...props} xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>;
}
