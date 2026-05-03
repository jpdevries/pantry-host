import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { HIDDEN_TAGS, ALL_CATEGORIES, CATEGORY_GROUPS } from '@pantry-host/shared/constants';
import {
  Trash, PencilSimple, Barcode,
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
import IngredientForm, { type IngredientFormVariables, type IngredientData } from '@pantry-host/shared/components/IngredientForm';
import BatchScanSession from '../components/BatchScanSession';

const QUERY = `
  query Ingredients($kitchenSlug: String) {
    ingredients(kitchenSlug: $kitchenSlug) { id name aliases category quantity unit itemSize itemSizeUnit alwaysOnHand tags barcode productMeta createdAt }
  }
`;

const ADD_MUTATION = `
  mutation($name: String!, $aliases: [String!], $category: String, $quantity: Float, $unit: String, $itemSize: Float, $itemSizeUnit: String, $alwaysOnHand: Boolean, $tags: [String!], $kitchenSlug: String) {
    addIngredient(name: $name, aliases: $aliases, category: $category, quantity: $quantity, unit: $unit, itemSize: $itemSize, itemSizeUnit: $itemSizeUnit, alwaysOnHand: $alwaysOnHand, tags: $tags, kitchenSlug: $kitchenSlug) { id }
  }
`;

const UPDATE_MUTATION = `
  mutation($id: String!, $name: String, $aliases: [String!], $category: String, $quantity: Float, $unit: String, $itemSize: Float, $itemSizeUnit: String, $alwaysOnHand: Boolean, $tags: [String!]) {
    updateIngredient(id: $id, name: $name, aliases: $aliases, category: $category, quantity: $quantity, unit: $unit, itemSize: $itemSize, itemSizeUnit: $itemSizeUnit, alwaysOnHand: $alwaysOnHand, tags: $tags) { id }
  }
`;

export default function IngredientsPage() {
  const kitchen = useParams<{ kitchen?: string }>().kitchen ?? 'home';
  const [ingredients, setIngredients] = useState<IngredientData[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [isSecure, setIsSecure] = useState(false);

  useEffect(() => {
    setIsSecure(window.location.protocol === 'https:' || window.location.hostname === 'localhost');
  }, []);

  async function load() {
    const { ingredients: list } = await gql<{ ingredients: IngredientData[] }>(QUERY, { kitchenSlug: kitchen });
    setIngredients(list);
    setLoading(false);
  }

  useEffect(() => { setLoading(true); load(); }, [kitchen]);

  async function handleAdd(vars: IngredientFormVariables) {
    await gql(ADD_MUTATION, { ...vars, kitchenSlug: kitchen });
    setShowAddForm(false);
    load();
  }

  async function handleUpdate(vars: IngredientFormVariables) {
    await gql(UPDATE_MUTATION, vars);
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string) {
    await gql(`mutation($id: String!) { deleteIngredient(id: $id) }`, { id });
    setDeleteConfirm(null);
    load();
  }

  const [filter, setFilter] = useState('');
  const [recentlyAdded, setRecentlyAdded] = useState(false);

  // Local midnight three calendar days back: today + the two prior full days.
  // Computed once per mount — a stale cutoff across a midnight boundary is
  // harmless (just keeps a day's worth of items visible briefly past their
  // age-out point).
  const recentCutoff = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - 2);
    return d.getTime();
  }, []);

  const filterSuggestions = useMemo(() => {
    const names = ingredients.map((i) => i.name);
    const tags = [...new Set(ingredients.flatMap((i) => i.tags))].map((t) => `#${t}`);
    return [...names, ...tags];
  }, [ingredients]);

  const filtered = useMemo(() => {
    let list = ingredients;
    if (recentlyAdded) {
      list = list.filter((i) => {
        const t = i.createdAt ? new Date(i.createdAt).getTime() : 0;
        return Number.isFinite(t) && t >= recentCutoff;
      });
    }
    if (!filter.trim()) return list;
    const q = filter.toLowerCase().replace(/^#/, '');
    return list.filter((i) =>
      i.name.toLowerCase().includes(q) ||
      i.category?.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q)) ||
      // Barcode match: lets users jump to a row by typing the printed
      // UPC/EAN digits (or a prefix). Barcodes are digit-only so case
      // is irrelevant; the raw stored value is what the user scanned.
      i.barcode?.includes(q)
    );
  }, [ingredients, filter, recentlyAdded, recentCutoff]);

  const grouped = filtered.reduce<Record<string, IngredientData[]>>((acc, ing) => {
    const cat = ing.category || 'other';
    (acc[cat] ??= []).push(ing);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">What's in Your Pantry?</h1>
        <div className="flex gap-2">
          {isSecure && (
            <button type="button" onClick={() => setScanning(true)} className="btn-secondary">
              Batch Scan
            </button>
          )}
          <button
            type="button"
            onClick={() => { setShowAddForm(!showAddForm); setEditingId(null); }}
            className="btn-primary"
          >
            {showAddForm ? 'Cancel' : '+ Add Ingredient'}
          </button>
        </div>
      </div>

      {scanning && (
        <BatchScanSession
          open={scanning}
          onComplete={() => { setScanning(false); load(); }}
          onCancel={() => setScanning(false)}
        />
      )}

      {showAddForm && (
        <div className="card p-4 mb-6">
          <IngredientForm
            onSubmit={handleAdd}
            onCancel={() => setShowAddForm(false)}
            autoFocus
          />
        </div>
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
            placeholder="garlic"
            className="field-input w-full"
          />
          <datalist id="pantry-filter-suggestions">
            {filterSuggestions.map((s) => <option key={s} value={s} />)}
          </datalist>
          <label className="flex items-center gap-2 mt-3 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={recentlyAdded}
              onChange={(e) => setRecentlyAdded(e.target.checked)}
              className="w-4 h-4 accent-accent"
            />
            <span>
              Recently added{' '}
              <span className="text-[var(--color-text-secondary)]">(last 3 days)</span>
            </span>
          </label>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />
          ))}
        </div>
      ) : ingredients.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm">
          Your pantry is empty. Click "+ Add Ingredient" to get started.
        </p>
      ) : (
        CATEGORY_GROUPS.filter((g) => g.categories.some((c) => grouped[c])).map((group) => (
          <div key={group.label} className="mb-8">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2">{GROUP_ICONS[group.label]} {group.label}</h2>
            {group.categories.filter((c) => grouped[c]).map((cat) => {
              const items = grouped[cat];
              return (
          <div key={cat} className="mb-4 ml-1">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 flex items-center gap-1.5">
              {CAT_ICONS[cat]} {cat}
            </h3>
            <ul className="divide-y divide-[var(--color-border-card)]">
              {items.map((ing) => (
                <li key={ing.id}>
                  {editingId === ing.id ? (
                    <div className="py-3">
                      <IngredientForm
                        ingredient={ing}
                        onSubmit={handleUpdate}
                        onCancel={() => setEditingId(null)}
                        autoFocus
                      />
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 py-3">
                      <div className="flex-1 min-w-0">
                        <span id={`ing-${ing.id}`} className="text-sm font-medium">{ing.name}</span>
                        {(ing.barcode || ing.productMeta) && (
                          <span
                            className="inline-flex items-center gap-0.5 ml-1.5 text-[var(--color-text-secondary)] align-text-bottom"
                            aria-label={ing.productMeta ? 'Barcode + nutrition data stored' : 'Barcode stored'}
                            title={ing.productMeta ? 'Barcode + nutrition data stored' : 'Barcode stored'}
                          >
                            <Barcode size={12} aria-hidden />
                          </span>
                        )}
                        {ing.quantity != null && (
                          <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                            {ing.quantity}{ing.unit && ing.unit !== 'whole' ? ` ${ing.unit}` : ''}
                            {ing.itemSize != null && (
                              <> • {ing.itemSize}{ing.itemSizeUnit ? ` ${ing.itemSizeUnit}` : ''}</>
                            )}
                          </span>
                        )}
                        {ing.alwaysOnHand && (
                          <span className="ml-2 text-xs text-[var(--color-text-secondary)] italic">always on hand</span>
                        )}
                        {ing.tags?.filter((t) => !HIDDEN_TAGS.has(t)).length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {ing.tags.filter((t) => !HIDDEN_TAGS.has(t)).map((t) => (
                              <span key={t} className="tag text-xs">{t}</span>
                            ))}
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => { setEditingId(ing.id); setShowAddForm(false); }}
                        className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-2 shrink-0"
                        aria-label="Edit"
                        aria-describedby={`ing-${ing.id}`}
                      >
                        <PencilSimple size={16} aria-hidden />
                      </button>
                      {deleteConfirm === ing.id ? (
                        <div className="flex gap-1 items-center shrink-0">
                          <span className="text-xs text-[var(--color-text-secondary)] mr-1">Delete?</span>
                          <button type="button" autoFocus onClick={() => handleDelete(ing.id)} className="btn-danger text-xs px-2 py-1" style={{ minHeight: 'auto' }} aria-label="Confirm delete" aria-describedby={`ing-${ing.id}`}>Yes</button>
                          <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary text-xs px-2 py-1" style={{ minHeight: 'auto' }} aria-label="Cancel delete" aria-describedby={`ing-${ing.id}`}>No</button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setDeleteConfirm(ing.id)}
                          className="text-[var(--color-text-secondary)] btn-delete p-2 shrink-0"
                          aria-label="Delete"
                          aria-describedby={`ing-${ing.id}`}
                        >
                          <Trash size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
