/**
 * App-specific IngredientForm wrapper — adds offline queuing
 * around the shared presentational IngredientForm.
 */

import SharedIngredientForm, { type IngredientFormVariables, type IngredientData } from '@pantry-host/shared/components/IngredientForm';
import { gql } from '@/lib/gql';
import { enqueue } from '@/lib/offlineQueue';

export type { IngredientData, IngredientFormVariables };

const ADD_INGREDIENT = `
  mutation AddIngredient($name: String!, $aliases: [String!], $category: String, $quantity: Float, $unit: String, $itemSize: Float, $itemSizeUnit: String, $alwaysOnHand: Boolean, $tags: [String!], $expiresAt: String, $kitchenSlug: String) {
    addIngredient(name: $name, aliases: $aliases, category: $category, quantity: $quantity, unit: $unit, itemSize: $itemSize, itemSizeUnit: $itemSizeUnit, alwaysOnHand: $alwaysOnHand, tags: $tags, expiresAt: $expiresAt, kitchenSlug: $kitchenSlug) { id }
  }
`;

const UPDATE_INGREDIENT = `
  mutation UpdateIngredient($id: String!, $name: String, $aliases: [String!], $category: String, $quantity: Float, $unit: String, $itemSize: Float, $itemSizeUnit: String, $alwaysOnHand: Boolean, $tags: [String!], $expiresAt: String) {
    updateIngredient(id: $id, name: $name, aliases: $aliases, category: $category, quantity: $quantity, unit: $unit, itemSize: $itemSize, itemSizeUnit: $itemSizeUnit, alwaysOnHand: $alwaysOnHand, tags: $tags, expiresAt: $expiresAt) { id }
  }
`;

interface Props {
  ingredient?: IngredientData;
  onSave: () => void;
  onCancel?: () => void;
  kitchenSlug?: string;
  autoFocus?: boolean;
}

export default function IngredientForm({ ingredient, onSave, onCancel, kitchenSlug, autoFocus }: Props) {
  async function handleSubmit(vars: IngredientFormVariables) {
    const editing = Boolean(vars.id);
    const mutation = editing ? UPDATE_INGREDIENT : ADD_INGREDIENT;
    const variables = editing ? vars : { ...vars, kitchenSlug: kitchenSlug ?? null };

    try {
      await gql(mutation, variables);
    } catch {
      enqueue(mutation, variables);
    }
    onSave();
  }

  return (
    <SharedIngredientForm
      ingredient={ingredient}
      onSubmit={handleSubmit}
      onCancel={onCancel}
      autoFocus={autoFocus}
    />
  );
}
