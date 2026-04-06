import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import { HIDDEN_TAGS, ALL_CATEGORIES, CATEGORY_GROUPS } from '@pantry-host/shared/constants';
import { Trash, PencilSimple } from '@phosphor-icons/react';
import IngredientForm, { type IngredientFormVariables, type IngredientData } from '@pantry-host/shared/components/IngredientForm';
import BatchScanSession from '../components/BatchScanSession';

const QUERY = `{ ingredients { id name category quantity unit alwaysOnHand tags } }`;

const ADD_MUTATION = `
  mutation($name: String!, $category: String, $quantity: Float, $unit: String, $alwaysOnHand: Boolean, $tags: [String!]) {
    addIngredient(name: $name, category: $category, quantity: $quantity, unit: $unit, alwaysOnHand: $alwaysOnHand, tags: $tags) { id }
  }
`;

const UPDATE_MUTATION = `
  mutation($id: String!, $name: String, $category: String, $quantity: Float, $unit: String, $alwaysOnHand: Boolean, $tags: [String!]) {
    updateIngredient(id: $id, name: $name, category: $category, quantity: $quantity, unit: $unit, alwaysOnHand: $alwaysOnHand, tags: $tags) { id }
  }
`;

export default function IngredientsPage() {
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
    const { ingredients: list } = await gql<{ ingredients: IngredientData[] }>(QUERY);
    setIngredients(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleAdd(vars: IngredientFormVariables) {
    await gql(ADD_MUTATION, vars);
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

  const grouped = ingredients.reduce<Record<string, IngredientData[]>>((acc, ing) => {
    const cat = ing.category || 'other';
    (acc[cat] ??= []).push(ing);
    return acc;
  }, {});

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Pantry</h1>
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
            <h2 className="text-lg font-bold mb-3">{group.label}</h2>
            {group.categories.filter((c) => grouped[c]).map((cat) => {
              const items = grouped[cat];
              return (
          <div key={cat} className="mb-4 ml-1">
            <h3 className="font-semibold text-sm uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
              {cat}
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
                        {ing.quantity != null && (
                          <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                            {ing.quantity}{ing.unit && ing.unit !== 'whole' ? ` ${ing.unit}` : ''}
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
