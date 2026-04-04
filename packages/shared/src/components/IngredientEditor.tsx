/**
 * IngredientEditor — dual-mode ingredient input (textarea or matrix).
 *
 * Textarea mode: freeform text, one ingredient per line. Supports @slug
 * references to other recipes (Cooklang-style).
 *
 * Matrix mode: structured form rows with name, quantity, unit fields.
 * Matches the self-hosted app's RecipeForm pattern.
 */

import { useState, useEffect } from 'react';
import { TextAlignLeft, Table, X } from '@phosphor-icons/react';
import { UNIT_GROUPS, COMMON_INGREDIENTS } from '../constants';

export interface IngredientRow {
  ingredientName: string;
  quantity: string;
  unit: string;
  sourceRecipeId: string | null;
}

export interface RecipeRef {
  id: string;
  slug: string;
  title: string;
}

interface Props {
  rows: IngredientRow[];
  onChange: (rows: IngredientRow[]) => void;
  error: string | null;
  onClearError: () => void;
  recipes: RecipeRef[];
}

type ViewMode = 'textarea' | 'matrix';

function rowsToText(rows: IngredientRow[], recipes: RecipeRef[]): string {
  return rows
    .map((r) => {
      if (r.sourceRecipeId) {
        const recipe = recipes.find((rr) => rr.id === r.sourceRecipeId);
        return `@${recipe?.slug || r.ingredientName}`;
      }
      return [r.quantity, r.unit !== 'whole' ? r.unit : '', r.ingredientName].filter(Boolean).join(' ');
    })
    .join('\n');
}

function textToRows(text: string): IngredientRow[] {
  return text
    .split('\n')
    .filter((l) => l.trim())
    .map((line) => {
      const refMatch = line.match(/^@([a-z0-9-]+)\{?\}?$/);
      if (refMatch) {
        return { ingredientName: refMatch[1], quantity: '', unit: 'whole', sourceRecipeId: '__pending__' };
      }
      const match = line.match(/^(\d+\.?\d*)\s*(\w+)?\s+(.+)$/);
      if (match) {
        return { ingredientName: match[3].trim(), quantity: match[1], unit: match[2] || 'whole', sourceRecipeId: null };
      }
      return { ingredientName: line.trim(), quantity: '', unit: 'whole', sourceRecipeId: null };
    });
}

export default function IngredientEditor({ rows, onChange, error, onClearError, recipes }: Props) {
  const [mode, setMode] = useState<ViewMode>('textarea');
  const [textValue, setTextValue] = useState('');

  function switchToTextarea() {
    setTextValue(rowsToText(rows, recipes));
    setMode('textarea');
  }

  function switchToMatrix() {
    const parsed = textToRows(textValue);
    const resolved = parsed.map((r) => {
      if (r.sourceRecipeId === '__pending__') {
        const recipe = recipes.find((rr) => rr.slug === r.ingredientName);
        return { ...r, sourceRecipeId: recipe?.id || null, ingredientName: recipe?.title || r.ingredientName };
      }
      return r;
    });
    onChange(resolved.length > 0 ? resolved : [{ ingredientName: '', quantity: '', unit: 'whole', sourceRecipeId: null }]);
    setMode('matrix');
  }

  function handleTextChange(text: string) {
    setTextValue(text);
    onClearError();
    onChange(textToRows(text));
  }

  function updateRow(idx: number, patch: Partial<IngredientRow>) {
    onChange(rows.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
    onClearError();
  }

  function removeRow(idx: number) {
    if (rows.length <= 1) return;
    onChange(rows.filter((_, i) => i !== idx));
  }

  function addRow() {
    onChange([...rows, { ingredientName: '', quantity: '', unit: 'whole', sourceRecipeId: null }]);
  }

  function addRecipeRow(recipeId: string) {
    const recipe = recipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    onChange([...rows, { ingredientName: recipe.title, quantity: '', unit: 'whole', sourceRecipeId: recipe.id }]);
  }

  useEffect(() => {
    if (mode === 'textarea' && rows.length > 0) {
      // Re-serialize when recipes become available (needed for @slug resolution)
      const hasRecipeRefs = rows.some((r) => r.sourceRecipeId && r.sourceRecipeId !== '__pending__');
      if (!textValue || (hasRecipeRefs && recipes.length > 0)) {
        setTextValue(rowsToText(rows, recipes));
      }
    }
  }, [rows, recipes]);

  return (
    <fieldset>
      <div className="flex items-center justify-between mb-1">
        <legend className="field-label">
          Ingredients <span className="font-normal text-[var(--color-text-secondary)]">({rows.filter((r) => r.ingredientName.trim()).length})</span>
        </legend>
        <div className="flex items-center gap-1" role="radiogroup" aria-label="Ingredient editor mode">
          <button
            type="button"
            onClick={mode === 'textarea' ? undefined : switchToTextarea}
            aria-label="Text mode"
            aria-pressed={mode === 'textarea'}
            className={`p-1 rounded ${mode === 'textarea' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
          >
            <TextAlignLeft size={16} weight={mode === 'textarea' ? 'bold' : 'light'} aria-hidden />
          </button>
          <button
            type="button"
            onClick={mode === 'matrix' ? undefined : switchToMatrix}
            aria-label="Table mode"
            aria-pressed={mode === 'matrix'}
            className={`p-1 rounded ${mode === 'matrix' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
          >
            <Table size={16} weight={mode === 'matrix' ? 'bold' : 'light'} aria-hidden />
          </button>
        </div>
      </div>

      {mode === 'textarea' && (
        <div>
          <textarea
            value={textValue}
            onChange={(e) => handleTextChange(e.target.value)}
            rows={6}
            placeholder={"2 cups flour\n1 tsp salt\n@raspberry-chia-seed-jam\n3 eggs"}
            className={`field-input w-full font-mono text-sm ${error ? 'border-red-500' : ''}`}
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            One per line. Use <code className="text-xs">@recipe-slug</code> to reference another recipe.
          </p>
        </div>
      )}

      {mode === 'matrix' && (
        <div>
          <datalist id="form-ingredients">
            {COMMON_INGREDIENTS.map((c) => <option key={c} value={c} />)}
          </datalist>
          <ul className="space-y-2">
            {rows.map((row, idx) => (
              <li key={idx} className="flex flex-wrap items-start gap-2">
                {row.sourceRecipeId ? (
                  <span className="field-input flex-1 text-[var(--color-accent)]">
                    @{recipes.find((r) => r.id === row.sourceRecipeId)?.slug || row.ingredientName}
                  </span>
                ) : (
                  <input
                    type="text"
                    list="form-ingredients"
                    value={row.ingredientName}
                    onChange={(e) => updateRow(idx, { ingredientName: e.target.value })}
                    placeholder="Ingredient"
                    aria-label={`Ingredient ${idx + 1} name`}
                    className="field-input flex-1"
                  />
                )}
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateRow(idx, { quantity: e.target.value })}
                  placeholder="Qty"
                  aria-label={`Ingredient ${idx + 1} quantity`}
                  className="field-input w-20"
                />
                <select
                  value={row.unit}
                  onChange={(e) => updateRow(idx, { unit: e.target.value })}
                  aria-label={`Ingredient ${idx + 1} unit`}
                  className="field-select w-28"
                >
                  {UNIT_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.units.map((u) => <option key={u} value={u}>{u}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label={`Remove ingredient ${idx + 1}`}
                  disabled={rows.length <= 1}
                  className="text-[var(--color-text-secondary)] hover:text-red-500 p-2 disabled:opacity-30"
                >
                  <X size={16} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={addRow} className="btn-secondary text-sm">+ Add ingredient</button>
            {recipes.length > 0 && (
              <select
                onChange={(e) => { if (e.target.value) { addRecipeRow(e.target.value); e.target.value = ''; } }}
                className="field-select text-sm w-auto"
                defaultValue=""
              >
                <option value="" disabled>+ Add recipe</option>
                {recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
              </select>
            )}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-red-500">{error}</p>
      )}
    </fieldset>
  );
}

/**
 * Validate @slug references and convert rows for submission.
 */
export function resolveIngredients(
  rows: IngredientRow[],
  recipes: RecipeRef[],
): { ingredients: { ingredientName: string; quantity: number | null; unit: string | null; sourceRecipeId?: string | null }[]; error: string | null } {
  const slugMap = new Map(recipes.map((r) => [r.slug, r]));
  const unresolved: string[] = [];

  const ingredients = rows
    .filter((r) => r.ingredientName.trim())
    .map((r) => {
      if (r.sourceRecipeId === '__pending__') {
        const recipe = slugMap.get(r.ingredientName);
        if (!recipe) {
          unresolved.push(r.ingredientName);
          return { ingredientName: r.ingredientName, quantity: null, unit: null, sourceRecipeId: null };
        }
        return { ingredientName: recipe.title, quantity: null, unit: null, sourceRecipeId: recipe.id };
      }
      return {
        ingredientName: r.ingredientName,
        quantity: r.quantity ? parseFloat(r.quantity) || null : null,
        unit: r.unit && r.unit !== 'whole' ? r.unit : null,
        sourceRecipeId: r.sourceRecipeId || null,
      };
    });

  if (unresolved.length > 0) {
    return {
      ingredients,
      error: `Recipe not found: ${unresolved.map((s) => `@${s}`).join(', ')}. Create ${unresolved.length === 1 ? 'it' : 'them'} first or remove the reference.`,
    };
  }

  return { ingredients, error: null };
}
