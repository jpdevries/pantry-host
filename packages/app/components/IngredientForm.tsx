import { useState } from 'react';
import { CATEGORIES, UNIT_GROUPS, COMMON_INGREDIENTS } from '@pantry-host/shared/constants';
import { gql } from '@/lib/gql';
import { enqueue } from '@/lib/offlineQueue';

interface Ingredient {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  alwaysOnHand: boolean;
  tags: string[];
}

interface Props {
  ingredient?: Ingredient;
  onSave: () => void;
  onCancel?: () => void;
  kitchenSlug?: string;
  autoFocus?: boolean;
}

type QtyMode = 'unset' | 'amount' | 'always';

const ADD_INGREDIENT = `
  mutation AddIngredient($name: String!, $category: String, $quantity: Float, $unit: String, $alwaysOnHand: Boolean, $tags: [String!], $kitchenSlug: String) {
    addIngredient(name: $name, category: $category, quantity: $quantity, unit: $unit, alwaysOnHand: $alwaysOnHand, tags: $tags, kitchenSlug: $kitchenSlug) { id }
  }
`;

const UPDATE_INGREDIENT = `
  mutation UpdateIngredient($id: String!, $name: String, $category: String, $quantity: Float, $unit: String, $alwaysOnHand: Boolean, $tags: [String!]) {
    updateIngredient(id: $id, name: $name, category: $category, quantity: $quantity, unit: $unit, alwaysOnHand: $alwaysOnHand, tags: $tags) { id }
  }
`;

function initialQtyMode(ingredient?: Ingredient): QtyMode {
  if (!ingredient) return 'unset';
  if (ingredient.alwaysOnHand) return 'always';
  if (ingredient.quantity != null) return 'amount';
  return 'unset';
}

export default function IngredientForm({ ingredient, onSave, onCancel, kitchenSlug, autoFocus }: Props) {
  const editing = Boolean(ingredient);
  const [name, setName] = useState(ingredient?.name ?? '');
  const [category, setCategory] = useState(ingredient?.category ?? '');
  const [qtyMode, setQtyMode] = useState<QtyMode>(initialQtyMode(ingredient));
  const [quantity, setQuantity] = useState<string>(ingredient?.quantity?.toString() ?? '');
  const [unit, setUnit] = useState(ingredient?.unit ?? 'whole');
  const [tagInput, setTagInput] = useState(ingredient?.tags?.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    setError(null);

    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
    const resolvedQty = qtyMode === 'amount' ? (quantity ? parseFloat(quantity) : null) : null;
    const resolvedUnit = qtyMode === 'amount' ? (unit || null) : null;
    const alwaysOnHand = qtyMode === 'always';

    const mutation = editing && ingredient ? UPDATE_INGREDIENT : ADD_INGREDIENT;
    const variables = editing && ingredient
      ? { id: ingredient.id, name: name.trim(), category: category || null, quantity: resolvedQty, unit: resolvedUnit, alwaysOnHand, tags }
      : { name: name.trim(), category: category || null, quantity: resolvedQty, unit: resolvedUnit, alwaysOnHand, tags, kitchenSlug: kitchenSlug ?? null };

    try {
      await gql(mutation, variables);
    } catch {
      // Offline or unreachable — queue for sync and let the user continue
      enqueue(mutation, variables);
    }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} aria-label={editing ? 'Edit ingredient' : 'Add ingredient'} noValidate>
      {/* Ingredient name with datalist */}
      <datalist id="common-ingredients">
        {COMMON_INGREDIENTS.map((i) => <option key={i} value={i} />)}
      </datalist>

      <div className="mb-4">
        <label htmlFor="ing-name" className="field-label">
          Name <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="ing-name"
          type="text"
          list="common-ingredients"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Olive oil"
          autoComplete="off"
          autoFocus={autoFocus}
          className="field-input w-full"
          aria-required="true"
        />
      </div>

      <div className="mb-4">
        <label htmlFor="ing-category" className="field-label">Category</label>
        <select
          id="ing-category"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="field-select w-full"
        >
          <option value="">— select —</option>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {/* Three-way quantity mode */}
      <fieldset className="mb-4">
        <legend className="field-label mb-2">Quantity</legend>
        <div className="flex rounded border border-[var(--color-border-card)] overflow-hidden w-fit" role="group">
          {(['unset', 'amount', 'always'] as QtyMode[]).map((mode) => {
            const labels: Record<QtyMode, string> = {
              unset: 'Unset',
              amount: 'Amount',
              always: 'Always on hand',
            };
            const active = qtyMode === mode;
            return (
              <button
                key={mode}
                type="button"
                aria-pressed={active}
                onClick={() => setQtyMode(mode)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent ${
                  active
                    ? 'bg-accent text-[var(--color-bg-body)]'
                    : 'bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:bg-[var(--color-accent-subtle)]'
                } border-r border-[var(--color-border-card)] last:border-r-0`}
              >
                {labels[mode]}
              </button>
            );
          })}
        </div>

        {qtyMode === 'amount' && (
          <div className="flex gap-2 mt-3">
            <input
              id="ing-quantity"
              type="number"
              min="0"
              step="any"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="0"
              aria-label="Quantity amount"
              className="field-input w-28"
            />
            <select
              id="ing-unit"
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              aria-label="Unit"
              className="field-select flex-1"
            >
              {UNIT_GROUPS.map((g) => (
                <optgroup key={g.label} label={g.label}>
                  {g.units.map((u) => <option key={u} value={u}>{u}</option>)}
                </optgroup>
              ))}
              <optgroup label="Other">
                <option value="other">other (type below)</option>
              </optgroup>
            </select>
          </div>
        )}

        {qtyMode === 'always' && (
          <p className="mt-2 text-sm text-[var(--color-text-secondary)]">
            This ingredient is always stocked — it won't be decremented when recipes are completed.
          </p>
        )}
      </fieldset>

      <div className="mb-5">
        <label htmlFor="ing-tags" className="field-label">
          Tags <span className="font-normal text-[var(--color-text-secondary)]">(comma-separated)</span>
        </label>
        <input
          id="ing-tags"
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="e.g. organic, gluten-free"
          className="field-input w-full"
          list="existing-tags"
        />
      </div>

      {error && (
        <p role="alert" id="ing-error" className="mb-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          aria-busy={saving}
          aria-describedby={error ? 'ing-error' : undefined}
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Ingredient'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
