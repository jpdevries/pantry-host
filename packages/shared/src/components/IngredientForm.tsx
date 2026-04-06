/**
 * IngredientForm — shared add/edit form for pantry ingredients.
 *
 * Presentational component: manages form state and validation,
 * calls onSubmit(variables) for the parent to handle persistence.
 */

import { useState } from 'react';
import { CATEGORY_GROUPS, UNIT_GROUPS, COMMON_INGREDIENTS } from '../constants';

export interface IngredientData {
  id: string;
  name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  alwaysOnHand: boolean;
  tags: string[];
}

export interface IngredientFormVariables {
  id?: string;
  name: string;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  alwaysOnHand: boolean;
  tags: string[];
}

interface Props {
  ingredient?: IngredientData;
  onSubmit: (variables: IngredientFormVariables) => Promise<void>;
  onCancel?: () => void;
  autoFocus?: boolean;
}

type QtyMode = 'unset' | 'amount' | 'always';

function initialQtyMode(ingredient?: IngredientData): QtyMode {
  if (!ingredient) return 'unset';
  if (ingredient.alwaysOnHand) return 'always';
  if (ingredient.quantity != null) return 'amount';
  return 'unset';
}

export default function IngredientForm({ ingredient, onSubmit, onCancel, autoFocus }: Props) {
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

    try {
      await onSubmit({
        ...(editing && ingredient ? { id: ingredient.id } : {}),
        name: name.trim(),
        category: category || null,
        quantity: resolvedQty,
        unit: resolvedUnit,
        alwaysOnHand,
        tags,
      });
    } catch {
      setError('Failed to save. Please try again.');
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      onKeyDown={(e) => { if (e.key === 'Escape' && onCancel) onCancel(); }}
      aria-label={editing ? 'Edit ingredient' : 'Add ingredient'}
      noValidate
    >
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
          {CATEGORY_GROUPS.map((g) => (
            <optgroup key={g.label} label={g.label}>
              {g.categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      {/* Three-way quantity mode */}
      <fieldset className="mb-4">
        <legend className="field-label mb-2">Quantity</legend>
        <div className="flex flex-wrap gap-3">
          {(['unset', 'amount', 'always'] as QtyMode[]).map((mode) => {
            const labels: Record<QtyMode, string> = {
              unset: 'Unset',
              amount: 'Amount',
              always: 'Always on hand',
            };
            return (
              <label key={mode} className="flex items-center gap-1.5 text-sm cursor-pointer">
                <input
                  type="radio"
                  name="qty-mode"
                  value={mode}
                  checked={qtyMode === mode}
                  onChange={() => setQtyMode(mode)}
                  className="accent-[var(--color-accent)]"
                />
                {labels[mode]}
              </label>
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
        />
      </div>

      {error && (
        <p role="alert" id="ing-error" className="mb-3 text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
        <button
          type="submit"
          disabled={saving || !name.trim()}
          aria-busy={saving}
          aria-describedby={error ? 'ing-error' : undefined}
          className="btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Ingredient'}
        </button>
      </div>
    </form>
  );
}
