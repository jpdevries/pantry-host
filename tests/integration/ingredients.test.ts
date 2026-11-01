import { describe, it, beforeEach } from 'node:test';
import { strict as assert } from 'node:assert';
import { gql } from './helpers/gql.ts';
import { resetDb } from './helpers/reset.ts';

const ADD = `
  mutation Add($name: String!, $tags: [String!]) {
    addIngredient(name: $name, tags: $tags) { id name tags }
  }
`;
const LIST = `
  query List($name: String, $tags: [String!]) {
    ingredients(name: $name, tags: $tags) { id name tags }
  }
`;
const UPDATE = `
  mutation Update($id: String!, $name: String) {
    updateIngredient(id: $id, name: $name) { id name }
  }
`;
const DELETE = `mutation Del($id: String!) { deleteIngredient(id: $id) }`;
const ADD_BULK = `
  mutation AddBulk($inputs: [IngredientInput!]!) {
    addIngredients(inputs: $inputs) { id name }
  }
`;

describe('ingredients CRUD', () => {
  beforeEach(() => resetDb());

  it('adds an ingredient and lists it', async () => {
    const { addIngredient } = await gql<{
      addIngredient: { id: string; name: string; tags: string[] };
    }>(ADD, { name: 'Eggs', tags: ['fridge'] });
    assert.equal(addIngredient.name, 'Eggs');
    assert.deepEqual(addIngredient.tags, ['fridge']);

    const { ingredients } = await gql<{ ingredients: { name: string }[] }>(LIST);
    assert.ok(ingredients.some((i) => i.name === 'Eggs'));
  });

  it('updates an ingredient name', async () => {
    const { addIngredient } = await gql<{ addIngredient: { id: string } }>(
      ADD,
      { name: 'Tomato' },
    );
    const { updateIngredient } = await gql<{
      updateIngredient: { name: string };
    }>(UPDATE, { id: addIngredient.id, name: 'Heirloom Tomato' });
    assert.equal(updateIngredient.name, 'Heirloom Tomato');
  });

  it('deletes an ingredient', async () => {
    const { addIngredient } = await gql<{ addIngredient: { id: string } }>(
      ADD,
      { name: 'Bread' },
    );
    const { deleteIngredient } = await gql<{ deleteIngredient: boolean }>(
      DELETE,
      { id: addIngredient.id },
    );
    assert.equal(deleteIngredient, true);

    const { ingredients } = await gql<{ ingredients: { name: string }[] }>(LIST);
    assert.ok(!ingredients.some((i) => i.name === 'Bread'));
  });

  it('bulk inserts ingredients', async () => {
    const inputs = ['Salt', 'Pepper', 'Olive Oil', 'Garlic', 'Onion'].map(
      (name) => ({ name }),
    );
    const { addIngredients } = await gql<{
      addIngredients: { id: string; name: string }[];
    }>(ADD_BULK, { inputs });
    assert.equal(addIngredients.length, 5);
    assert.deepEqual(addIngredients.map((i) => i.name).sort(), [
      'Garlic',
      'Olive Oil',
      'Onion',
      'Pepper',
      'Salt',
    ]);
  });

  it('filters by name (ILIKE substring, case-insensitive)', async () => {
    await gql(ADD, { name: 'Pickled Onions' });
    await gql(ADD, { name: 'Red Onion' });
    await gql(ADD, { name: 'Garlic' });
    const { ingredients } = await gql<{ ingredients: { name: string }[] }>(
      LIST,
      { name: 'onion' },
    );
    assert.deepEqual(ingredients.map((i) => i.name).sort(), [
      'Pickled Onions',
      'Red Onion',
    ]);
  });

  it('filters by tags (array containment)', async () => {
    await gql(ADD, { name: 'Milk', tags: ['fridge', 'dairy'] });
    await gql(ADD, { name: 'Butter', tags: ['fridge', 'dairy'] });
    await gql(ADD, { name: 'Flour', tags: ['pantry'] });
    const { ingredients } = await gql<{ ingredients: { name: string }[] }>(
      LIST,
      { tags: ['dairy'] },
    );
    assert.deepEqual(ingredients.map((i) => i.name).sort(), [
      'Butter',
      'Milk',
    ]);
  });
});

// ── Pantry review foundations (expiry, stock dates, bulk ops) ───────────────

const FIELDS = 'id name quantity unit tags aliases expiresAt stockedAt updatedAt createdAt';
const ADD_FULL = `
  mutation AddFull($name: String!, $quantity: Float, $unit: String, $tags: [String!], $aliases: [String!], $expiresAt: String) {
    addIngredient(name: $name, quantity: $quantity, unit: $unit, tags: $tags, aliases: $aliases, expiresAt: $expiresAt) { ${FIELDS} }
  }
`;
const UPDATE_QTY = `
  mutation UpdateQty($id: String!, $quantity: Float, $unit: String, $expiresAt: String) {
    updateIngredient(id: $id, quantity: $quantity, unit: $unit, expiresAt: $expiresAt) { ${FIELDS} }
  }
`;
const UPDATE_QTY_CLEAR = `
  mutation UpdateQtyClear($id: String!, $quantity: Float, $unit: String) {
    updateIngredient(id: $id, quantity: $quantity, unit: $unit, expiresAt: null) { ${FIELDS} }
  }
`;
const UPDATE_MANY = `
  mutation UpdateMany($inputs: [IngredientPatchInput!]!) {
    updateIngredients(inputs: $inputs) { ${FIELDS} }
  }
`;
const DELETE_MANY = `mutation DeleteMany($ids: [String!]!) { deleteIngredients(ids: $ids) }`;
const TOUCH = `mutation Touch($ids: [String!]!) { touchIngredients(ids: $ids) { ${FIELDS} } }`;
const MERGE = `
  mutation Merge($survivorId: String!, $mergeIds: [String!]!) {
    mergeIngredients(survivorId: $survivorId, mergeIds: $mergeIds) {
      ingredient { ${FIELDS} }
      mergedIds
      unmergedQuantities
    }
  }
`;

type Row = {
  id: string; name: string; quantity: number | null; unit: string | null; tags: string[]; aliases: string[];
  expiresAt: string | null; stockedAt: string; updatedAt: string; createdAt: string;
};

const tick = () => new Promise((r) => setTimeout(r, 5));

describe('ingredient expiry and stock dates', () => {
  beforeEach(() => resetDb());

  it('stores expiresAt and sets stockedAt on add', async () => {
    const { addIngredient: milk } = await gql<{ addIngredient: Row }>(ADD_FULL, {
      name: 'Milk', quantity: 4, unit: 'cup', expiresAt: '2026-11-10',
    });
    assert.equal(milk.expiresAt, '2026-11-10');
    assert.ok(milk.stockedAt);
    assert.ok(milk.updatedAt);
  });

  it('moves stockedAt only when the quantity goes up', async () => {
    const { addIngredient: milk } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'Milk', quantity: 4, unit: 'cup' });
    await tick();
    const { updateIngredient: down } = await gql<{ updateIngredient: Row }>(UPDATE_QTY, { id: milk.id, quantity: 3, unit: 'cup' });
    assert.equal(down.stockedAt, milk.stockedAt, 'a decrease is not a restock');
    assert.notEqual(down.updatedAt, milk.updatedAt, 'updatedAt always moves');
    await tick();
    const { updateIngredient: up } = await gql<{ updateIngredient: Row }>(UPDATE_QTY, { id: milk.id, quantity: 8, unit: 'cup' });
    assert.notEqual(up.stockedAt, milk.stockedAt, 'an increase is a restock');
  });

  it('keeps expiresAt when omitted and clears it on explicit null', async () => {
    const { addIngredient: milk } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'Milk', quantity: 4, unit: 'cup', expiresAt: '2026-11-10' });
    const { updateIngredient: kept } = await gql<{ updateIngredient: Row }>(UPDATE_QTY, { id: milk.id, quantity: 4, unit: 'cup' });
    assert.equal(kept.expiresAt, '2026-11-10');
    const { updateIngredient: cleared } = await gql<{ updateIngredient: Row }>(UPDATE_QTY_CLEAR, { id: milk.id, quantity: 4, unit: 'cup' });
    assert.equal(cleared.expiresAt, null);
  });
});

describe('bulk pantry mutations', () => {
  beforeEach(() => resetDb());

  it('updateIngredients keeps omitted fields and returns input order', async () => {
    const { addIngredient: a } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'Garlic', quantity: 3, unit: 'whole' });
    const { addIngredient: b } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'Eggs', quantity: 12, unit: 'whole', expiresAt: '2026-11-20' });
    const { updateIngredients: rows } = await gql<{ updateIngredients: Row[] }>(UPDATE_MANY, {
      inputs: [{ id: b.id, expiresAt: null }, { id: a.id, expiresAt: '2026-12-01' }],
    });
    assert.deepEqual(rows.map((r) => r.id), [b.id, a.id]);
    assert.equal(rows[0].expiresAt, null, 'null clears in bulk too');
    assert.equal(rows[0].quantity, 12, 'quantity untouched by a date-only patch');
    assert.equal(rows[1].expiresAt, '2026-12-01');
    assert.equal(rows[1].quantity, 3);
  });

  it('updateIngredients fails as a whole on an unknown id', async () => {
    const { addIngredient: a } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'Garlic', quantity: 3, unit: 'whole' });
    await assert.rejects(
      gql(UPDATE_MANY, { inputs: [{ id: a.id, quantity: 99 }, { id: 'missing', quantity: 1 }] }),
      /not found/i,
    );
    const { ingredients: full } = await gql<{ ingredients: Row[] }>(`query { ingredients(name: "Garlic") { ${FIELDS} } }`);
    assert.equal(full[0].quantity, 3, 'rolled back');
  });

  it('deleteIngredients returns the number removed', async () => {
    const { addIngredient: a } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'A' });
    const { addIngredient: b } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'B' });
    await gql(ADD_FULL, { name: 'C' });
    const { deleteIngredients } = await gql<{ deleteIngredients: number }>(DELETE_MANY, { ids: [a.id, b.id, 'nope'] });
    assert.equal(deleteIngredients, 2);
    const { ingredients } = await gql<{ ingredients: { name: string }[] }>(LIST);
    assert.deepEqual(ingredients.map((i) => i.name), ['C']);
  });

  it('touchIngredients restocks without changing quantity', async () => {
    const { addIngredient: a } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'Eggs', quantity: 12, unit: 'whole' });
    await tick();
    const { touchIngredients: [t] } = await gql<{ touchIngredients: Row[] }>(TOUCH, { ids: [a.id] });
    assert.notEqual(t.stockedAt, a.stockedAt);
    assert.equal(t.quantity, 12);
  });

  it('mergeIngredients sums compatible quantities, unions tags, and aliases the merged names', async () => {
    const { addIngredient: a } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'Garlic', quantity: 3, unit: 'whole', tags: ['costco'] });
    const { addIngredient: b } = await gql<{ addIngredient: Row }>(ADD_FULL, {
      name: 'garlic cloves', quantity: 5, unit: 'whole', tags: ['farmers-market', 'Costco'], aliases: ['garlic clove'], expiresAt: '2026-11-05',
    });
    const { mergeIngredients: m } = await gql<{ mergeIngredients: { ingredient: Row; mergedIds: string[]; unmergedQuantities: string[] } }>(
      MERGE, { survivorId: a.id, mergeIds: [b.id, a.id] },
    );
    assert.equal(m.ingredient.quantity, 8);
    assert.deepEqual(m.mergedIds, [b.id]);
    assert.deepEqual([...m.ingredient.tags].sort(), ['costco', 'farmers-market'], 'case-insensitive tag union');
    assert.deepEqual([...m.ingredient.aliases].sort(), ['garlic clove', 'garlic cloves']);
    assert.equal(m.ingredient.expiresAt, '2026-11-05', 'earliest expiry wins');
    assert.deepEqual(m.unmergedQuantities, []);
    const { ingredients } = await gql<{ ingredients: { name: string }[] }>(LIST);
    assert.deepEqual(ingredients.map((i) => i.name), ['Garlic']);
  });

  it('mergeIngredients reports quantities it could not add', async () => {
    const { addIngredient: a } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'Olive Oil', quantity: 2, unit: 'cup' });
    const { addIngredient: b } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'olive oil', quantity: 8, unit: 'oz' });
    const { addIngredient: c } = await gql<{ addIngredient: Row }>(ADD_FULL, { name: 'EVOO', quantity: 16, unit: 'fl oz' });
    const { mergeIngredients: m } = await gql<{ mergeIngredients: { ingredient: Row; unmergedQuantities: string[] } }>(
      MERGE, { survivorId: a.id, mergeIds: [b.id, c.id] },
    );
    assert.equal(m.ingredient.quantity, 4, '16 fl oz converts to 2 cups; weight oz does not');
    assert.deepEqual(m.unmergedQuantities, ['olive oil']);
  });
});
