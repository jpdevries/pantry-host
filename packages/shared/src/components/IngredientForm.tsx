/**
 * IngredientForm — shared add/edit form for pantry ingredients.
 *
 * Presentational component: manages form state and validation,
 * calls onSubmit(variables) for the parent to handle persistence.
 */

import { useState } from 'react';
import { Barcode, CaretRight } from '@phosphor-icons/react';
import { CATEGORY_GROUPS, UNIT_GROUPS, ALL_CATEGORIES } from '../constants';
import IngredientTypeahead from './IngredientTypeahead';

const CATEGORY_DROPDOWN_GROUPS = CATEGORY_GROUPS.map((g) => ({ label: g.label, items: g.categories }));
import { IngredientMetaPanel } from './IngredientMetaPanel';

/** Units from the "Count" group — the only ones where a per-item measurable size makes sense.
 * "3 jars × 12 fl oz" is meaningful; "2 cups × 4 cups" is not. */
const COUNT_UNITS: readonly string[] = UNIT_GROUPS.find((g) => g.label === 'Count')?.units ?? [];

export interface IngredientData {
  id: string;
  name: string;
  /** Alternative names that match in recipe lookups. Display always
   *  uses `name`; aliases participate in pantryIndex matching only. */
  aliases?: string[] | null;
  category: string | null;
  quantity: number | null;
  unit: string | null;
  itemSize?: number | null;
  itemSizeUnit?: string | null;
  alwaysOnHand: boolean;
  tags: string[];
  /** Opt-in barcode metadata (STORE_BARCODE_META setting). */
  barcode?: string | null;
  productMeta?: string | null;
}

export interface IngredientFormVariables {
  id?: string;
  name: string;
  aliases: string[];
  category: string | null;
  quantity: number | null;
  unit: string | null;
  itemSize: number | null;
  itemSizeUnit: string | null;
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

/** Build the comma-separated initial value for the Name input from the
 *  canonical name + any stored aliases. "Dark Roasted Peanut Butter" +
 *  ["peanut butter"] → "Dark Roasted Peanut Butter, peanut butter". */
function joinNameAndAliases(name: string, aliases: string[] | null | undefined): string {
  return [name, ...(aliases ?? [])].filter((s) => s && s.trim()).join(', ');
}

export default function IngredientForm({ ingredient, onSubmit, onCancel, autoFocus }: Props) {
  const editing = Boolean(ingredient);
  const [name, setName] = useState(joinNameAndAliases(ingredient?.name ?? '', ingredient?.aliases));
  const [category, setCategory] = useState(ingredient?.category ?? '');
  const [qtyMode, setQtyMode] = useState<QtyMode>(initialQtyMode(ingredient));
  const [quantity, setQuantity] = useState<string>(ingredient?.quantity?.toString() ?? '');
  const [unit, setUnit] = useState(ingredient?.unit ?? 'whole');
  const [itemSize, setItemSize] = useState<string>(ingredient?.itemSize?.toString() ?? '');
  const [itemSizeUnit, setItemSizeUnit] = useState<string>(ingredient?.itemSizeUnit ?? '');
  const [tagInput, setTagInput] = useState(ingredient?.tags?.join(', ') ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    // Parse the comma-separated name field: first non-empty entry is the
    // canonical name; the rest are aliases (deduped, never the canonical).
    const nameParts = name.split(',').map((s) => s.trim()).filter(Boolean);
    const canonicalName = nameParts[0] ?? '';
    if (!canonicalName) return;
    const aliases = [...new Set(nameParts.slice(1))]
      .filter((a) => a.toLowerCase() !== canonicalName.toLowerCase());

    setSaving(true);
    setError(null);

    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
    const resolvedQty = qtyMode === 'amount' ? (quantity ? parseFloat(quantity) : null) : null;
    const resolvedUnit = qtyMode === 'amount' ? (unit || null) : null;
    // Per-item size is only meaningful when unit is from the Count group
    // (whole, jar, can, etc.). Non-Count units → drop any item_size data.
    const supportsItemSize = qtyMode === 'amount' && COUNT_UNITS.includes(unit);
    const resolvedItemSize = supportsItemSize && itemSize ? parseFloat(itemSize) : null;
    const resolvedItemSizeUnit = supportsItemSize && resolvedItemSize != null ? (itemSizeUnit || null) : null;
    const alwaysOnHand = qtyMode === 'always';

    try {
      await onSubmit({
        ...(editing && ingredient ? { id: ingredient.id } : {}),
        name: canonicalName,
        aliases,
        category: category || null,
        quantity: resolvedQty,
        unit: resolvedUnit,
        itemSize: resolvedItemSize,
        itemSizeUnit: resolvedItemSizeUnit,
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
      <div className="mb-4">
        <label htmlFor="ing-name" className="field-label inline-flex items-center gap-1.5">
          <span>Name <span aria-hidden="true" className="text-red-500">*</span></span>
          {(ingredient?.barcode || ingredient?.productMeta) && (
            <a
              href="#ing-meta-panel"
              onClick={(e) => {
                // Force-open the Meta info disclosure when the user clicks
                // the indicator. Plain anchor jump alone wouldn't expand it.
                const det = document.getElementById('ing-meta-panel') as HTMLDetailsElement | null;
                if (det) det.open = true;
              }}
              className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              aria-label="Barcode metadata stored — jump to details"
              title="Barcode metadata stored"
            >
              <Barcode size={14} aria-hidden />
            </a>
          )}
        </label>
        <IngredientTypeahead
          id="ing-name"
          value={name}
          onChange={setName}
          required
          autoFocus={autoFocus}
          placeholder="e.g. Olive oil"
          aria-required="true"
          aria-describedby="ing-name-hint"
        />
        <p id="ing-name-hint" className="text-xs text-[var(--color-text-secondary)] mt-1 pretty">
          Comma-separated. The first is the display name; later entries
          also match ingredient names in recipes.
        </p>
      </div>

      <div className="mb-4">
        <label htmlFor="ing-category" className="field-label">Category</label>
        <IngredientTypeahead
          id="ing-category"
          mode="single"
          value={category}
          onChange={setCategory}
          placeholder="— select —"
          suggestions={ALL_CATEGORIES}
          groups={CATEGORY_DROPDOWN_GROUPS}
        />
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
          <>
            <div className="qty-unit-grid mt-3">
              <input
                id="ing-quantity"
                type="number"
                min="0"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="0"
                aria-label="Quantity amount"
                className="field-input"
              />
              <select
                id="ing-unit"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                aria-label="Unit"
                className="field-select"
              >
                {UNIT_GROUPS.map((g) => (
                  <optgroup key={g.label} label={g.label}>
                    {g.units.map((u) => <option key={u} value={u}>{u}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            {/* Per-item size disclosure — only offered for Count units (whole, jar, can, etc.)
                where "3 jars × 12 fl oz" is meaningful. Non-Count units like "2 cups" have
                no per-item dimension to add. */}
            {COUNT_UNITS.includes(unit) && (
            <details
              className="mt-3"
              open={itemSize !== '' || (itemSizeUnit !== '' && itemSizeUnit !== unit)}
            >
              <summary className="cursor-pointer text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] select-none">
                Per-item size <span className="font-normal">(optional)</span>
              </summary>
              <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
                Use when each unit has a known size — e.g. 3 jars × 12 fl oz.
              </p>
              <div className="qty-unit-grid mt-2">
                <input
                  id="ing-item-size"
                  type="number"
                  min="0"
                  step="any"
                  value={itemSize}
                  onChange={(e) => setItemSize(e.target.value)}
                  placeholder="size"
                  aria-label="Per-item size"
                  className="field-input"
                />
                <select
                  id="ing-item-size-unit"
                  value={itemSizeUnit}
                  onChange={(e) => setItemSizeUnit(e.target.value)}
                  aria-label="Per-item size unit"
                  className="field-select"
                >
                  <option value="">— size unit —</option>
                  {UNIT_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.units.map((u) => <option key={u} value={u}>{u}</option>)}
                    </optgroup>
                  ))}
                </select>
              </div>
            </details>
            )}
          </>
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

      {/* Display-only Meta info from barcode scan. Hidden when no
          metadata is attached. Edits to this panel are out of scope —
          the data comes from the scanner. */}
      {(ingredient?.barcode || ingredient?.productMeta) && (
        <details id="ing-meta-panel" className="group mb-5 border-t border-[var(--color-border-card)] pt-4">
          <summary className="cursor-pointer text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] select-none hover:text-[var(--color-text-primary)] group-open:text-[var(--color-text-primary)] list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-2">
            <CaretRight size={14} weight="bold" aria-hidden className="transition-transform group-open:rotate-90" />
            <span className="inline-flex items-center gap-1">
              <Barcode size={14} aria-hidden />
              Meta info
            </span>
          </summary>
          <IngredientMetaPanel
            barcode={ingredient.barcode}
            productMeta={ingredient.productMeta}
          />
        </details>
      )}

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
          disabled={saving || !name.split(',').some((s) => s.trim())}
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
