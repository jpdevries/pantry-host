import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { gql } from './helpers/gql.ts';
import { resetDb } from './helpers/reset.ts';

const CREATE = `
  mutation Create($title: String!) {
    createRecipe(title: $title, instructions: "x", ingredients: []) {
      id queued lastMadeAt
    }
  }
`;
const TOGGLE = `
  mutation Toggle($id: String!) {
    toggleRecipeQueued(id: $id) { id queued }
  }
`;
const COMPLETE = `
  mutation Complete($id: String!) {
    completeRecipe(id: $id) { id lastMadeAt }
  }
`;

describe('recipe lifecycle', () => {
  beforeEach(() => resetDb());

  it('toggles queued on and off', async () => {
    const { createRecipe } = await gql<{
      createRecipe: { id: string; queued: boolean };
    }>(CREATE, { title: 'Roast Chicken' });
    assert.equal(createRecipe.queued, false);

    const t1 = await gql<{ toggleRecipeQueued: { queued: boolean } }>(TOGGLE, {
      id: createRecipe.id,
    });
    assert.equal(t1.toggleRecipeQueued.queued, true);

    const t2 = await gql<{ toggleRecipeQueued: { queued: boolean } }>(TOGGLE, {
      id: createRecipe.id,
    });
    assert.equal(t2.toggleRecipeQueued.queued, false);
  });

  it('stamps lastMadeAt to a recent timestamp on completeRecipe', async () => {
    const { createRecipe } = await gql<{
      createRecipe: { id: string; lastMadeAt: string | null };
    }>(CREATE, { title: 'Lentil Soup' });
    assert.equal(createRecipe.lastMadeAt, null);

    const { completeRecipe } = await gql<{
      completeRecipe: { lastMadeAt: string | null };
    }>(COMPLETE, { id: createRecipe.id });

    assert.notEqual(completeRecipe.lastMadeAt, null);
    const dt = new Date(completeRecipe.lastMadeAt!).getTime();
    assert.ok(Date.now() - dt < 10_000);
  });
});

// ── cookRecipe: lastMadeAt + pantry decrement ───────────────────────────────

const ADD_PANTRY = `
  mutation AddPantry($inputs: [IngredientInput!]!) {
    addIngredients(inputs: $inputs) { id name quantity stockedAt }
  }
`;
const CREATE_WITH_INGREDIENTS = `
  mutation CreateWithIngredients($title: String!, $servings: Int, $ingredients: [RecipeIngredientInput!]!) {
    createRecipe(title: $title, instructions: "x", servings: $servings, ingredients: $ingredients) { id lastMadeAt }
  }
`;
const COOK = `
  mutation Cook($id: String!, $servings: Int, $dryRun: Boolean, $decrementPantry: Boolean) {
    cookRecipe(id: $id, servings: $servings, dryRun: $dryRun, decrementPantry: $decrementPantry) {
      applied
      recipe { id lastMadeAt }
      pantryChanges { recipeIngredient ingredientId pantryName before after unit status }
    }
  }
`;
const PANTRY = `query Pantry { ingredients { id name quantity stockedAt } }`;

type Change = { recipeIngredient: string; ingredientId: string | null; pantryName: string | null; before: number | null; after: number | null; unit: string | null; status: string };
type CookResult = { applied: boolean; recipe: { id: string; lastMadeAt: string | null }; pantryChanges: Change[] };
const byLine = (r: CookResult) => Object.fromEntries(r.pantryChanges.map((c) => [c.recipeIngredient, c]));

async function seedScramble() {
  const { addIngredients } = await gql<{ addIngredients: { id: string; name: string; quantity: number; stockedAt: string }[] }>(ADD_PANTRY, {
    inputs: [
      { name: 'Eggs', quantity: 12, unit: 'whole' },
      { name: 'Milk', quantity: 4, unit: 'cup' },
      { name: 'Garlic', quantity: 3, unit: 'whole', aliases: ['garlic cloves'] },
      { name: 'Salt', alwaysOnHand: true },
      { name: 'Peanut Butter', quantity: 3, unit: 'jar', itemSize: 12, itemSizeUnit: 'fl oz' },
      { name: 'Flour' },
    ],
  });
  const { createRecipe } = await gql<{ createRecipe: { id: string } }>(CREATE_WITH_INGREDIENTS, {
    title: 'Scramble',
    servings: 2,
    ingredients: [
      { ingredientName: 'eggs', quantity: 4, unit: 'whole' },
      { ingredientName: 'milk', quantity: 8, unit: 'fl oz' },
      { ingredientName: 'garlic, minced', quantity: 1, unit: 'whole' },
      { ingredientName: 'salt', quantity: 1, unit: 'tsp' },
      { ingredientName: 'peanut butter', quantity: 1, unit: 'cup' },
      { ingredientName: 'flour', quantity: 1, unit: 'cup' },
      { ingredientName: 'butter', quantity: 2, unit: 'tbsp' },
    ],
  });
  return { pantry: addIngredients, recipeId: createRecipe.id };
}

describe('cookRecipe', () => {
  beforeEach(() => resetDb());

  it('dry run plans the decrement without writing anything', async () => {
    const { recipeId } = await seedScramble();
    const { cookRecipe } = await gql<{ cookRecipe: CookResult }>(COOK, { id: recipeId, servings: 4, dryRun: true });
    assert.equal(cookRecipe.applied, false);
    assert.equal(cookRecipe.recipe.lastMadeAt, null);

    const c = byLine(cookRecipe);
    assert.equal(c.eggs.status, 'decremented');
    assert.equal(c.eggs.before, 12);
    assert.equal(c.eggs.after, 4, 'servings 4 of 2 doubles the recipe');
    assert.equal(c.milk.after, 2, '2 × 8 fl oz = 2 cups off 4');
    assert.equal(c['garlic, minced'].after, 1, 'prep note stripped before matching');
    assert.equal(c.salt.status, 'always_on_hand');
    assert.equal(c['peanut butter'].status, 'decremented');
    assert.equal(c['peanut butter'].after, 1.667, '36 fl oz − 16 fl oz, back in jars');
    assert.equal(c.flour.status, 'untracked');
    assert.equal(c.butter.status, 'unmatched');

    const { ingredients } = await gql<{ ingredients: { name: string; quantity: number | null }[] }>(PANTRY);
    assert.equal(ingredients.find((i) => i.name === 'Eggs')!.quantity, 12, 'pantry untouched');
  });

  it('applies the decrement, sets lastMadeAt, and leaves stockedAt alone', async () => {
    const { pantry, recipeId } = await seedScramble();
    const eggsBefore = pantry.find((p) => p.name === 'Eggs')!;
    const { cookRecipe } = await gql<{ cookRecipe: CookResult }>(COOK, { id: recipeId, servings: 4 });
    assert.equal(cookRecipe.applied, true);
    assert.notEqual(cookRecipe.recipe.lastMadeAt, null);

    const { ingredients } = await gql<{ ingredients: { name: string; quantity: number | null; stockedAt: string }[] }>(PANTRY);
    const eggs = ingredients.find((i) => i.name === 'Eggs')!;
    assert.equal(eggs.quantity, 4);
    assert.equal(eggs.stockedAt, eggsBefore.stockedAt, 'cooking is consumption, not a restock');
    assert.equal(ingredients.find((i) => i.name === 'Milk')!.quantity, 2);
    assert.equal(ingredients.find((i) => i.name === 'Flour')!.quantity, null);
  });

  it('clamps at zero and can skip the pantry entirely', async () => {
    const { recipeId } = await seedScramble();
    await gql(COOK, { id: recipeId, servings: 4 });
    const { cookRecipe: again } = await gql<{ cookRecipe: CookResult }>(COOK, { id: recipeId, servings: 4 });
    assert.equal(byLine(again).eggs.after, 0);

    const { cookRecipe: noDec } = await gql<{ cookRecipe: CookResult }>(COOK, { id: recipeId, decrementPantry: false });
    assert.equal(noDec.applied, true);
    assert.equal(noDec.pantryChanges.length, 0);
  });

  it('rejects an unknown recipe', async () => {
    await assert.rejects(gql(COOK, { id: 'missing' }), /not found/i);
  });
});
