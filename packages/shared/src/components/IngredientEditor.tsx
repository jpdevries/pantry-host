/**
 * IngredientEditor — dual-mode ingredient input (textarea or matrix).
 *
 * Textarea mode: freeform text, one ingredient per line. Supports @slug
 * references to other recipes (Cooklang-style).
 *
 * Matrix mode: structured form rows with name, quantity, unit fields.
 * Matches the self-hosted app's RecipeForm pattern.
 */

import { useState, useEffect, useRef } from 'react';
import { TextAlignLeft, Table, X } from '@phosphor-icons/react';
import { UNIT_GROUPS, ALL_UNITS, COMMON_INGREDIENTS } from '../constants';

/** Map of common aliases and plurals → canonical unit from UNIT_GROUPS */
const UNIT_ALIASES: Record<string, string> = {
  // Plurals of Count units
  cloves: 'clove', stalks: 'stalk', slices: 'slice', bunches: 'bunch',
  heads: 'head', cans: 'can', jars: 'jar', dozens: 'dozen',
  // Plurals of Volume
  cups: 'cup', pints: 'pt', quarts: 'qt', gallons: 'gal',
  teaspoons: 'tsp', tablespoons: 'tbsp', teaspoon: 'tsp', tablespoon: 'tbsp',
  liters: 'L', litres: 'L', liter: 'L', litre: 'L',
  milliliters: 'ml', millilitres: 'ml', milliliter: 'ml', millilitre: 'ml',
  // Plurals of Weight
  ounces: 'oz', ounce: 'oz', pounds: 'lb', pound: 'lb',
  grams: 'g', gram: 'g', kilograms: 'kg', kilogram: 'kg', kilos: 'kg', kilo: 'kg',
  // Plurals of Pinch/Taste
  pinches: 'pinch', dashes: 'dash',
  // Spelled-out abbreviations
  'fluid ounces': 'fl oz', 'fluid ounce': 'fl oz',
};

/** Normalize a parsed unit string to a UNIT_GROUPS value, or return as-is for freeform */
function normalizeUnit(raw: string): string {
  if (!raw) return 'whole';
  const lower = raw.toLowerCase().trim();
  // Direct match
  if ((ALL_UNITS as readonly string[]).includes(lower)) return lower;
  // Check if original case matches (e.g. "L")
  if ((ALL_UNITS as readonly string[]).includes(raw.trim())) return raw.trim();
  // Alias lookup
  if (UNIT_ALIASES[lower]) return UNIT_ALIASES[lower];
  // Singular fallback: strip trailing 's' and check
  if (lower.endsWith('s')) {
    const singular = lower.slice(0, -1);
    if ((ALL_UNITS as readonly string[]).includes(singular)) return singular;
  }
  // No match — return as-is (freeform unit)
  return lower;
}

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
  defaultMode?: ViewMode;
}

type ViewMode = 'textarea' | 'matrix';

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function rowsToText(rows: IngredientRow[], recipes: RecipeRef[]): string {
  return rows
    .filter((r) => r.ingredientName.trim() || r.sourceRecipeId)
    .map((r) => {
      if (r.sourceRecipeId && r.sourceRecipeId !== '__pick__') {
        const recipe = recipes.find((rr) => rr.id === r.sourceRecipeId);
        return `@${recipe?.slug || toSlug(r.ingredientName)}`;
      }
      return [r.quantity, r.unit || '', r.ingredientName].filter(Boolean).join(' ');
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

/** Check if a unit value is a known unit from UNIT_GROUPS */
function isKnownUnit(unit: string): boolean {
  return !unit || unit === 'whole' || (ALL_UNITS as readonly string[]).includes(unit);
}

export default function IngredientEditor({ rows, onChange, error, onClearError, recipes, defaultMode = 'textarea' }: Props) {
  const [mode, setMode] = useState<ViewMode>(defaultMode);
  const [textValue, setTextValue] = useState('');
  const [freeformUnits, setFreeformUnits] = useState<Set<number>>(new Set());
  const textareaFocused = useRef(false);

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
    const finalRows = resolved.length > 0 ? resolved : [{ ingredientName: '', quantity: '', unit: 'whole', sourceRecipeId: null }];
    // Track which rows have freeform (non-standard) units — they get a datalist input
    const freeform = new Set<number>();
    finalRows.forEach((r, i) => { if (!isKnownUnit(r.unit)) freeform.add(i); });
    setFreeformUnits(freeform);
    onChange(finalRows);
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
    // Re-index freeform set after removal
    setFreeformUnits((prev) => {
      const next = new Set<number>();
      for (const i of prev) {
        if (i < idx) next.add(i);
        else if (i > idx) next.add(i - 1);
      }
      return next;
    });
  }

  function addRow() {
    onChange([...rows, { ingredientName: '', quantity: '', unit: 'whole', sourceRecipeId: null }]);
  }

  function addRecipeRow() {
    onChange([...rows, { ingredientName: '', quantity: '', unit: 'whole', sourceRecipeId: '__pick__' }]);
  }

  useEffect(() => {
    // Textarea is source of truth while focused — don't overwrite it
    if (textareaFocused.current) return;
    if (mode === 'textarea' && rows.length > 0) {
      const hasRecipeRefs = rows.some((r) => r.sourceRecipeId && r.sourceRecipeId !== '__pending__' && r.sourceRecipeId !== '__pick__');
      // Wait for recipes to load before serializing rows with recipe refs
      if (hasRecipeRefs && recipes.length === 0) return;
      setTextValue(rowsToText(rows, recipes));
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
            onFocus={() => { textareaFocused.current = true; }}
            onBlur={() => { textareaFocused.current = false; }}
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
              <li key={idx} className="flex items-start gap-2">
                <div className="flex flex-wrap items-start gap-2 flex-1 min-w-0">
                  {row.sourceRecipeId ? (
                    <select
                      value={row.sourceRecipeId === '__pick__' ? '' : (row.sourceRecipeId || '')}
                      onChange={(e) => {
                        const recipe = recipes.find((r) => r.id === e.target.value);
                        if (recipe) updateRow(idx, { sourceRecipeId: recipe.id, ingredientName: recipe.title });
                      }}
                      aria-label={`Ingredient ${idx + 1}: select recipe`}
                      className="field-select flex-1"
                    >
                      <option value="" disabled>Choose a recipe…</option>
                      {recipes.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
                    </select>
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
                  {!freeformUnits.has(idx) ? (
                    <select
                      value={row.unit || 'whole'}
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
                  ) : (
                    <>
                      <input
                        type="text"
                        list={`unit-suggestions-${idx}`}
                        value={row.unit}
                        onChange={(e) => updateRow(idx, { unit: e.target.value })}
                        aria-label={`Ingredient ${idx + 1} unit`}
                        className="field-input w-28"
                      />
                      <datalist id={`unit-suggestions-${idx}`}>
                        {ALL_UNITS.map((u) => <option key={u} value={u} />)}
                      </datalist>
                    </>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeRow(idx)}
                  aria-label={`Remove ingredient ${idx + 1}`}
                  disabled={rows.length <= 1}
                  className="text-[var(--color-text-secondary)] hover:text-red-500 p-1 shrink-0 mt-2.5 disabled:opacity-30"
                >
                  <X size={14} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 mt-3">
            <button type="button" onClick={addRow} className="btn-secondary text-sm">+ Add ingredient</button>
            {recipes.length > 0 && (
              <button type="button" onClick={addRecipeRow} className="btn-secondary text-sm">+ Add recipe as ingredient</button>
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
    .filter((r) => r.ingredientName.trim() || r.sourceRecipeId)
    .map((r) => {
      if (r.sourceRecipeId === '__pick__') {
        unresolved.push('unselected recipe');
        return { ingredientName: '', quantity: null, unit: null, sourceRecipeId: null };
      }
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
