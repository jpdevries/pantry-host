/**
 * CookPreviewModal — "I Made This" with the pantry decrement shown first.
 *
 * The recipe page calls `cookRecipe(dryRun: true)`, hands the plan here,
 * and the cook writes only what the user confirms. Lines the server would
 * not change (not in the pantry, always on hand, no amount, units that
 * don't convert) are listed so the user knows why, with no controls.
 *
 * Used by both tiers; `applyCookPlan` does the writes through whichever
 * `gql` client the caller passes.
 */

import { useEffect, useState } from 'react';
import Modal from './Modal';
import type { PantryChange, PantryChangeStatus } from '../pantry-decrement';

export type GqlClient = <T = unknown>(query: string, variables?: Record<string, unknown>) => Promise<T>;

export const COOK_DRY_RUN = `
  mutation CookDryRun($id: String!, $servings: Int) {
    cookRecipe(id: $id, servings: $servings, dryRun: true) {
      pantryChanges { recipeIngredient ingredientId pantryName before after unit status }
    }
  }
`;

const COOK_APPLY = `
  mutation Cook($id: String!, $servings: Int, $decrementPantry: Boolean) {
    cookRecipe(id: $id, servings: $servings, decrementPantry: $decrementPantry) { recipe { id lastMadeAt } }
  }
`;

const UPDATE_QUANTITIES = `
  mutation CookQuantities($inputs: [IngredientPatchInput!]!) {
    updateIngredients(inputs: $inputs) { id quantity }
  }
`;

/** The plan from a dry run. */
export async function planCook(gql: GqlClient, recipeId: string, servings: number | null): Promise<PantryChange[]> {
  const data = await gql<{ cookRecipe: { pantryChanges: PantryChange[] } }>(COOK_DRY_RUN, { id: recipeId, servings });
  return data.cookRecipe.pantryChanges;
}

/**
 * Record the cook and write the confirmed decrements. When every
 * decrementable line is confirmed the server does the whole thing in one
 * transaction; a partial selection records the cook without a decrement
 * and patches the chosen rows to the planned quantities.
 */
export async function applyCookPlan(
  gql: GqlClient,
  args: { recipeId: string; servings: number | null; plan: PantryChange[]; selectedIds: string[] },
): Promise<string | null> {
  const decrementable = args.plan.filter((c) => c.status === 'decremented' && c.ingredientId);
  const selected = new Set(args.selectedIds);
  const all = decrementable.length > 0 && decrementable.every((c) => selected.has(c.ingredientId!));
  if (all) {
    const data = await gql<{ cookRecipe: { recipe: { lastMadeAt: string | null } } }>(COOK_APPLY, {
      id: args.recipeId, servings: args.servings, decrementPantry: true,
    });
    return data.cookRecipe.recipe.lastMadeAt;
  }
  const data = await gql<{ cookRecipe: { recipe: { lastMadeAt: string | null } } }>(COOK_APPLY, {
    id: args.recipeId, servings: args.servings, decrementPantry: false,
  });
  const inputs = decrementable
    .filter((c) => selected.has(c.ingredientId!))
    .map((c) => ({ id: c.ingredientId, quantity: c.after }));
  if (inputs.length > 0) await gql(UPDATE_QUANTITIES, { inputs });
  return data.cookRecipe.recipe.lastMadeAt;
}

const SKIP_REASON: Record<Exclude<PantryChangeStatus, 'decremented'>, string> = {
  unmatched: 'not in your pantry',
  always_on_hand: 'always on hand',
  untracked: 'no quantity tracked',
  no_quantity: 'the recipe gives no amount',
  unconvertible: "units don't convert",
};

function fmt(n: number | null): string {
  if (n == null) return '';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

interface Props {
  open: boolean;
  onClose: () => void;
  plan: PantryChange[];
  saving: boolean;
  /** Confirm with the pantry row ids to decrement. */
  onConfirm: (ingredientIds: string[]) => void;
  /** Record the cook without touching the pantry. */
  onSkip: () => void;
}

export default function CookPreviewModal({ open, onClose, plan, saving, onConfirm, onSkip }: Props) {
  const decrementable = plan.filter((c) => c.status === 'decremented' && c.ingredientId);
  const skipped = plan.filter((c) => c.status !== 'decremented');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (open) setSelected(new Set(decrementable.map((c) => c.ingredientId!)));
    // Reset when a new plan arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, plan]);

  const toggle = (id: string) =>
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });

  return (
    <Modal open={open} onClose={onClose} title="Update pantry after cooking">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-card)] shrink-0">
        <h2 className="font-bold text-lg">Update your pantry?</h2>
        <button type="button" onClick={onClose} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1" aria-label="Close">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      <div className="overflow-y-auto flex-1 px-4 py-3">
        {decrementable.length > 0 ? (
          <fieldset>
            <legend className="text-sm text-[var(--color-text-secondary)] mb-2">
              Uncheck anything you didn't use from your pantry.
            </legend>
            <ul className="divide-y divide-[var(--color-border-card)]">
              {decrementable.map((c) => {
                const id = c.ingredientId!;
                return (
                  <li key={id} className="py-2">
                    <label className="flex items-start gap-3 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        onChange={() => toggle(id)}
                        className="mt-1 w-4 h-4 accent-accent shrink-0"
                      />
                      <span className="flex-1 min-w-0">
                        <span className="font-medium">{c.pantryName}</span>
                        <span className="ml-2 text-sm text-[var(--color-text-secondary)] tabular-nums">
                          {fmt(c.before)} → {fmt(c.after)} {c.unit ?? ''}
                        </span>
                        {c.pantryName && c.recipeIngredient.toLowerCase() !== c.pantryName.toLowerCase() && (
                          <span className="block text-xs text-[var(--color-text-secondary)]">for “{c.recipeIngredient}”</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : (
          <p className="text-sm text-[var(--color-text-secondary)] py-2">
            Nothing in your pantry tracks a quantity for this recipe, so there is nothing to subtract.
          </p>
        )}

        {skipped.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] select-none">
              Not changed ({skipped.length})
            </summary>
            <ul className="mt-2 text-sm text-[var(--color-text-secondary)] space-y-1">
              {skipped.map((c, i) => (
                <li key={`${c.recipeIngredient}-${i}`}>
                  {c.recipeIngredient}
                  {c.pantryName && c.pantryName.toLowerCase() !== c.recipeIngredient.toLowerCase() ? ` (${c.pantryName})` : ''}
                  : {SKIP_REASON[c.status as Exclude<PantryChangeStatus, 'decremented'>] ?? c.status}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="flex gap-3 p-4 border-t border-[var(--color-border-card)] shrink-0">
        <button type="button" onClick={onSkip} disabled={saving} className="btn-secondary flex-1">
          Skip
        </button>
        <button
          type="button"
          onClick={() => onConfirm([...selected])}
          disabled={saving || decrementable.length === 0}
          aria-busy={saving}
          className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? 'Saving…' : `Update pantry${selected.size > 0 ? ` (${selected.size})` : ''}`}
        </button>
      </div>
    </Modal>
  );
}
