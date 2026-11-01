import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { harness } from './helpers/harness.ts';
import { gql } from './helpers/gql.ts';
import { resetDb } from './helpers/reset.ts';

// Pantry Review over MCP (packages/mcp/src/tools/review.ts + the bulk pantry
// tools in tools/ingredients.ts + the pantry-aware mark_recipe_cooked). The
// review engine is @pantry-host/shared/pantry-review, the same one the UIs
// run; these tests cover the MCP surface, not the engine (see its unit tests).
const REPO = join(import.meta.dirname, '..', '..');
const TSX_CLI = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
// Same constraint as mcp-books.test.ts: the MCP server's shared imports load
// under Node 20; MCP_NODE points at one.
const MCP_NODE = process.env.MCP_NODE || process.execPath;

async function connect(): Promise<Client> {
  const { NODE_TEST_CONTEXT: _, ...parentEnv } = process.env;
  const transport = new StdioClientTransport({
    command: MCP_NODE,
    args: [TSX_CLI, join(REPO, 'packages', 'mcp', 'src', 'index.ts')],
    env: { ...(parentEnv as Record<string, string>), GRAPHQL_URL: `${harness().url}/graphql` },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'mcp-pantry-review-test', version: '1.0.0' });
  try {
    await client.connect(transport);
  } catch (e) {
    throw new Error(`The MCP server didn't start under ${MCP_NODE} (${(e as Error).message}). Set MCP_NODE to a Node 20 binary.`);
  }
  return client;
}

type Content = { type: string; text?: string };

/** Tool results here are "one-line summary\n<JSON>"; return both. */
function parse(res: { content: unknown }): { head: string; json: any } {
  const text = (res.content as Content[]).find((c) => c.type === 'text')?.text ?? '';
  const nl = text.indexOf('\n');
  if (nl === -1) return { head: text, json: null };
  return { head: text.slice(0, nl), json: JSON.parse(text.slice(nl + 1)) };
}

describe('MCP pantry review', () => {
  let client: Client;
  let ids: Record<string, string>;
  let recipeId: string;

  before(async () => {
    await resetDb();
    const { addIngredients } = await gql<{ addIngredients: { id: string; name: string }[] }>(`mutation {
      addIngredients(inputs: [
        { name: "Garlic", category: "vegetables", quantity: 3, unit: "whole", tags: ["costco"] },
        { name: "garlic cloves", category: "vegetables", quantity: 5, unit: "whole", aliases: ["garlic"] },
        { name: "Yogurt", category: "dairy", quantity: 1, unit: "whole", expiresAt: "2026-10-01" },
        { name: "Eggs", category: "eggs", quantity: 12, unit: "whole" },
        { name: "Milk", category: "dairy", quantity: 4, unit: "cup" },
        { name: "Salt", category: "herbs & spices", alwaysOnHand: true }
      ]) { id name }
    }`);
    ids = Object.fromEntries(addIngredients.map((r) => [r.name, r.id]));
    const { createRecipe } = await gql<{ createRecipe: { id: string } }>(`mutation {
      createRecipe(title: "Scramble", instructions: "x", servings: 2, ingredients: [
        { ingredientName: "eggs", quantity: 4, unit: "whole" },
        { ingredientName: "milk", quantity: 8, unit: "fl oz" },
        { ingredientName: "salt", quantity: 1, unit: "tsp" },
        { ingredientName: "butter", quantity: 1, unit: "tbsp" }
      ]) { id }
    }`);
    recipeId = createRecipe.id;
    client = await connect();
  });

  after(async () => { await client?.close(); });

  it('registers the review and bulk tools', async () => {
    const { tools } = await client.listTools();
    const names = new Set(tools.map((t) => t.name));
    for (const n of ['review_pantry', 'update_ingredients', 'remove_ingredients', 'touch_ingredients', 'merge_ingredients', 'mark_recipe_cooked']) {
      assert.ok(names.has(n), `missing tool ${n}`);
    }
    assert.equal(tools.length, 39);
  });

  it('review_pantry reports findings with names, provenance, next steps and a survivor', async () => {
    const { head, json } = parse(await client.callTool({ name: 'review_pantry', arguments: {} }));
    assert.match(head, /finding\(s\) across 6 rows in the home pantry/);
    assert.equal(json.rowsReviewed, 6);
    assert.equal(json.counts.expired, 1, 'the yogurt with a stated past date');
    assert.equal(json.counts.duplicate, 1, 'the garlic pair');
    const yogurt = json.findings.find((f: any) => f.signal === 'expired');
    assert.deepEqual(yogurt.names, ['Yogurt']);
    assert.equal(yogurt.provenance, 'explicit');
    assert.match(yogurt.reason, /^best-by passed/);
    const dup = json.findings.find((f: any) => f.signal === 'duplicate');
    assert.deepEqual([...dup.names].sort(), ['Garlic', 'garlic cloves']);
    assert.ok(dup.survivorId);
    assert.ok(json.nextSteps.duplicate.includes('merge_ingredients'));
    assert.ok(json.nextSteps.expired.includes('touch_ingredients'));
    // Fresh eggs and milk, and always-on-hand salt, are not flagged.
    assert.equal(json.findings.flatMap((f: any) => f.names).includes('Eggs'), false);
  });

  it('review_pantry honours the signals filter', async () => {
    const { json } = parse(await client.callTool({ name: 'review_pantry', arguments: { signals: ['duplicate'] } }));
    assert.equal(json.findings.length, 1);
    assert.equal(json.findings[0].signal, 'duplicate');
  });

  it('merge_ingredients merges into the suggested survivor', async () => {
    const { json: review } = parse(await client.callTool({ name: 'review_pantry', arguments: { signals: ['duplicate'] } }));
    const dup = review.findings[0];
    const others = dup.ids.filter((id: string) => id !== dup.survivorId);
    const res = await client.callTool({ name: 'merge_ingredients', arguments: { survivorId: dup.survivorId, mergeIds: others } });
    const merged = JSON.parse((res.content as Content[])[0].text!);
    assert.equal(merged.ingredient.quantity, 8);
    assert.deepEqual(merged.mergedIds, others);
    assert.deepEqual(merged.unmergedQuantities, []);
    assert.ok(merged.ingredient.aliases.length >= 1, 'the merged name became an alias');
    const { ingredients } = await gql<{ ingredients: { name: string }[] }>(`{ ingredients(name: "garlic") { name } }`);
    assert.equal(ingredients.length, 1);
  });

  it('update_ingredients keeps omitted fields; touch_ingredients restocks', async () => {
    const res = await client.callTool({ name: 'update_ingredients', arguments: { inputs: [{ id: ids.Yogurt, quantity: 0 }] } });
    const [row] = JSON.parse((res.content as Content[])[0].text!);
    assert.equal(row.quantity, 0);
    assert.equal(row.expiresAt, '2026-10-01', 'a quantity-only patch keeps the date');

    const before = await gql<{ ingredients: { stockedAt: string }[] }>(`{ ingredients(name: "Eggs") { stockedAt } }`);
    await new Promise((r) => setTimeout(r, 5));
    const touched = await client.callTool({ name: 'touch_ingredients', arguments: { ids: [ids.Eggs] } });
    assert.match((touched.content as Content[])[0].text!, /Marked 1 row\(s\) as still in stock: Eggs/);
    const afterTouch = await gql<{ ingredients: { stockedAt: string }[] }>(`{ ingredients(name: "Eggs") { stockedAt } }`);
    assert.notEqual(afterTouch.ingredients[0].stockedAt, before.ingredients[0].stockedAt);
  });

  it('mark_recipe_cooked previews with dryRun, then decrements the pantry', async () => {
    const dry = parse(await client.callTool({ name: 'mark_recipe_cooked', arguments: { id: recipeId, servings: 4, dryRun: true } }));
    assert.match(dry.head, /^Dry run for "Scramble": 2 pantry row\(s\) would be decremented\. Nothing was written\./);
    const byLine = Object.fromEntries(dry.json.map((c: any) => [c.recipeIngredient, c]));
    assert.equal(byLine.eggs.status, 'decremented');
    assert.equal(byLine.eggs.after, 4);
    assert.equal(byLine.milk.after, 2, '16 fl oz = 2 cups off 4');
    assert.equal(byLine.salt.status, 'always_on_hand');
    assert.equal(byLine.butter.status, 'unmatched');
    const untouched = await gql<{ ingredients: { quantity: number }[] }>(`{ ingredients(name: "Eggs") { quantity } }`);
    assert.equal(untouched.ingredients[0].quantity, 12);

    const real = parse(await client.callTool({ name: 'mark_recipe_cooked', arguments: { id: recipeId, servings: 4 } }));
    assert.match(real.head, /^Marked "Scramble" as cooked at .* 2 pantry row\(s\) decremented\./);
    const after = await gql<{ ingredients: { name: string; quantity: number }[] }>(`{ ingredients { name quantity } }`);
    assert.equal(after.ingredients.find((i) => i.name === 'Eggs')!.quantity, 4);
    assert.equal(after.ingredients.find((i) => i.name === 'Milk')!.quantity, 2);
  });

  it('remove_ingredients deletes and reports the count', async () => {
    const res = await client.callTool({ name: 'remove_ingredients', arguments: { ids: [ids.Yogurt, 'missing'] } });
    assert.match((res.content as Content[])[0].text!, /Deleted 1 ingredient\(s\)/);
  });

  it('exposes the review as a pantry://review resource', async () => {
    const read = await client.readResource({ uri: 'pantry://review' });
    const json = JSON.parse((read.contents[0] as { text: string }).text);
    assert.equal(json.kitchenSlug, 'home');
    assert.ok('counts' in json && 'findings' in json);
  });
});
