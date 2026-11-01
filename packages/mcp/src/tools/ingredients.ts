import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gql } from '../graphql-client.js';

const INGREDIENT_FIELDS = `id name aliases category quantity unit itemSize itemSizeUnit alwaysOnHand tags barcode productMeta expiresAt stockedAt updatedAt createdAt`;

const EXPIRES_AT_DOC = 'Stated best-by date (YYYY-MM-DD or ISO 8601). Leave unset when the user did not state one: the review estimates expiry from the category and stock-in date, and stated dates always win over estimates, so never invent one.';

export function registerIngredientTools(server: McpServer) {
  server.tool(
    'search_pantry',
    'Search pantry ingredients. Returns rows including `aliases` (alternative names that participate in recipe matching), `barcode`, `productMeta` (a JSON-encoded blob of allowlisted metadata), `expiresAt` (a stated best-by date or null; estimates are not stored — use review_pantry for them), `stockedAt` (when stock last came in) and `updatedAt`. IMPORTANT: the `barcode` field is **overloaded** — it stores any printed product identifier, which may be a UPC/EAN (8/12/13-digit, packaged goods, backed by Open Food Facts) OR a PLU (4-digit for conventional produce, 5-digit starting with 9 for organic; backed by the IFPS dataset). Detect the type from length. `productMeta` has `plu_source: "ifps"` set on PLU-sourced rows and different fields (`commodity`, `variety`, `size`, `organic`, `category`) than OFF-sourced rows (`nutriments`, `nutriscore_grade`, etc.). The barcode + productMeta fields are populated only for rows scanned with STORE_BARCODE_META on (off by default).',
    {
      name: z.string().optional().describe('Search by ingredient name (partial match, case-insensitive)'),
      tags: z.array(z.string()).optional().describe('Filter by ingredient tags (AND match)'),
      kitchenSlug: z.string().optional().describe('Kitchen slug (default: home)'),
    },
    async ({ name, tags, kitchenSlug }) => {
      const data = await gql<{ ingredients: unknown[] }>(
        `query($name: String, $tags: [String!], $kitchenSlug: String) {
          ingredients(name: $name, tags: $tags, kitchenSlug: $kitchenSlug) { ${INGREDIENT_FIELDS} }
        }`,
        { name, tags, kitchenSlug },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.ingredients, null, 2) }] };
    },
  );

  server.tool(
    'add_ingredient',
    'Add an ingredient to the pantry. Use itemSize + itemSizeUnit for packaged goods with known per-item sizing (e.g. "3 jars × 12 fl oz": quantity=3, unit="jar", itemSize=12, itemSizeUnit="fl oz"). Power-user: set barcode + productMeta (JSON-encoded OFF metadata) when you already have that data — persisted only if the host side has opted in.',
    {
      name: z.string().describe('Ingredient name'),
      category: z.enum(['vegetables', 'fruit', 'fresh herbs', 'dairy', 'meat & poultry', 'seafood & fish', 'eggs', 'tofu & tempeh', 'legumes & pulses', 'nuts & seeds', 'plant-based milks', 'dry goods & grains', 'canned & jarred', 'condiments & sauces', 'herbs & spices', 'oils & vinegars', 'baking', 'frozen', 'deli & charcuterie', 'beverages', 'snacks', 'other']).optional().describe('Category'),
      quantity: z.number().optional().describe('Quantity'),
      unit: z.string().optional().describe('Unit (e.g. cup, oz, lb, whole)'),
      itemSize: z.number().optional().describe('Per-item size — the measurable size of one unit (e.g. 12 for a 12 fl oz jar)'),
      itemSizeUnit: z.string().optional().describe('Unit of the per-item size (e.g. "fl oz", "oz", "g")'),
      alwaysOnHand: z.boolean().optional().describe('If true, never track quantity'),
      tags: z.array(z.string()).optional().describe('Tags'),
      aliases: z.array(z.string()).optional().describe('Alternative names for matching. Recipe ingredient names that match any alias resolve to this pantry row. Useful when a canonical pantry name (e.g. "Dark Roasted Peanut Butter") differs from how recipes refer to the ingredient (e.g. "peanut butter").'),
      barcode: z.string().optional().describe('Printed product identifier. Length discriminates type: 8/12/13 digits = UPC-A/EAN-8/EAN-13 (packaged goods); 4 digits in 3000–4999 = PLU (conventional produce); 5 digits starting with 9 = PLU (organic produce). Typically written by the scanner; agents can pass one when sourcing data from elsewhere.'),
      productMeta: z.string().optional().describe('JSON-encoded allowlisted metadata. Two provenance shapes: OFF-sourced (nutriments, nutriscore_grade, nova_group, labels_tags, allergens_tags, ingredients_text, etc.) and IFPS-sourced (plu_source: "ifps", commodity, variety, size, organic, category). Persisted as JSONB.'),
      expiresAt: z.string().optional().describe(EXPIRES_AT_DOC),
      kitchenSlug: z.string().optional().describe('Kitchen slug (default: home)'),
    },
    async (args) => {
      const data = await gql<{ addIngredient: unknown }>(
        `mutation($name: String!, $category: String, $quantity: Float, $unit: String, $itemSize: Float, $itemSizeUnit: String, $alwaysOnHand: Boolean, $tags: [String!], $aliases: [String!], $barcode: String, $productMeta: String, $expiresAt: String, $kitchenSlug: String) {
          addIngredient(name: $name, category: $category, quantity: $quantity, unit: $unit, itemSize: $itemSize, itemSizeUnit: $itemSizeUnit, alwaysOnHand: $alwaysOnHand, tags: $tags, aliases: $aliases, barcode: $barcode, productMeta: $productMeta, expiresAt: $expiresAt, kitchenSlug: $kitchenSlug) { ${INGREDIENT_FIELDS} }
        }`,
        args,
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.addIngredient, null, 2) }] };
    },
  );

  server.tool(
    'add_ingredients',
    'Bulk-add multiple ingredients to the pantry. Set itemSize + itemSizeUnit for packaged goods with known per-item sizing. Set barcode + productMeta (JSON-encoded) when sourcing from barcode data.',
    {
      ingredients: z.array(z.object({
        name: z.string(),
        category: z.string().optional(),
        quantity: z.number().optional(),
        unit: z.string().optional(),
        itemSize: z.number().optional(),
        itemSizeUnit: z.string().optional(),
        alwaysOnHand: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        aliases: z.array(z.string()).optional(),
        barcode: z.string().optional(),
        productMeta: z.string().optional(),
        expiresAt: z.string().optional().describe(EXPIRES_AT_DOC),
      })).describe('Array of ingredients to add'),
      kitchenSlug: z.string().optional().describe('Kitchen slug (default: home)'),
    },
    async ({ ingredients, kitchenSlug }) => {
      const data = await gql<{ addIngredients: unknown[] }>(
        `mutation($inputs: [IngredientInput!]!, $kitchenSlug: String) {
          addIngredients(inputs: $inputs, kitchenSlug: $kitchenSlug) { ${INGREDIENT_FIELDS} }
        }`,
        { inputs: ingredients, kitchenSlug },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.addIngredients, null, 2) }] };
    },
  );

  server.tool(
    'update_ingredient',
    "Update an existing pantry ingredient. To mark as out of stock, set quantity to 0 — this preserves tags (like harvest locations) and other metadata. Prefer this over remove_ingredient when the user runs out of something. Omitted args are preserved (COALESCE semantics) — passing `aliases` REPLACES the array; use `add_pantry_alias` if you want to append without losing existing entries.",
    {
      id: z.string().describe('Ingredient ID'),
      name: z.string().optional().describe('New name'),
      category: z.string().optional().describe('New category'),
      quantity: z.number().optional().describe('New quantity. Set to 0 to mark as out of stock while keeping tags and metadata.'),
      unit: z.string().optional().describe('New unit'),
      itemSize: z.number().optional().describe('New per-item size (e.g. 12 for a 12 fl oz jar)'),
      itemSizeUnit: z.string().optional().describe('New per-item size unit'),
      alwaysOnHand: z.boolean().optional().describe('Mark as always on hand'),
      tags: z.array(z.string()).optional().describe('New tags (e.g. harvest location tags like costco, farmers-market)'),
      aliases: z.array(z.string()).optional().describe('New aliases — alternative names for matching against recipe ingredients. Replaces the existing list.'),
      barcode: z.string().optional().describe('Printed product identifier. UPC/EAN (8/12/13 digits) or PLU (4 digits for conventional produce, 5-digit 9XXXX for organic). Overloaded by design — one column, discriminated by length.'),
      productMeta: z.string().optional().describe('JSON-encoded allowlisted OFF metadata.'),
      expiresAt: z.string().nullable().optional().describe(`${EXPIRES_AT_DOC} Omit to keep the current date; pass null to clear it.`),
    },
    async (args) => {
      // Only send expiresAt when the caller gave it (null included): an
      // omitted variable keeps the stored date, an explicit null clears it.
      const { expiresAt, ...rest } = args;
      const variables = expiresAt === undefined ? rest : { ...rest, expiresAt };
      const data = await gql<{ updateIngredient: unknown }>(
        `mutation($id: String!, $name: String, $category: String, $quantity: Float, $unit: String, $itemSize: Float, $itemSizeUnit: String, $alwaysOnHand: Boolean, $tags: [String!], $aliases: [String!], $barcode: String, $productMeta: String, $expiresAt: String) {
          updateIngredient(id: $id, name: $name, category: $category, quantity: $quantity, unit: $unit, itemSize: $itemSize, itemSizeUnit: $itemSizeUnit, alwaysOnHand: $alwaysOnHand, tags: $tags, aliases: $aliases, barcode: $barcode, productMeta: $productMeta, expiresAt: $expiresAt) { ${INGREDIENT_FIELDS} }
        }`,
        variables,
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.updateIngredient, null, 2) }] };
    },
  );

  server.tool(
    'add_pantry_alias',
    "Append one or more aliases to an existing pantry row without overwriting the canonical name. Use this when you notice a recipe ingredient name doesn't resolve to a pantry row that should match — adding the recipe's wording as an alias bridges the two without rebuilding the row. Aliases are deduped against the existing list and against the canonical name. Display surfaces always use `name`; aliases participate in matching only.",
    {
      id: z.string().describe('Pantry row ID'),
      aliases: z.array(z.string()).min(1).describe('Aliases to append (deduped against existing). E.g. ["peanut butter", "creamy peanut butter"] for a row named "Dark Roasted Peanut Butter".'),
    },
    async ({ id, aliases }) => {
      // Two-step: fetch existing aliases, merge, write back. updateIngredient
      // replaces the array, so we have to read first to preserve.
      const fetched = await gql<{ ingredients: { id: string; name: string; aliases: string[] }[] }>(
        `{ ingredients { id name aliases } }`,
      );
      const row = fetched.ingredients.find((i) => i.id === id);
      if (!row) {
        return { content: [{ type: 'text' as const, text: `Pantry row not found: ${id}` }] };
      }
      const existing = row.aliases ?? [];
      const merged = [...new Set([...existing, ...aliases])]
        .filter((a) => a.toLowerCase() !== row.name.toLowerCase());
      const data = await gql<{ updateIngredient: { id: string; name: string; aliases: string[] } }>(
        `mutation($id: String!, $aliases: [String!]) {
          updateIngredient(id: $id, aliases: $aliases) { id name aliases }
        }`,
        { id, aliases: merged },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.updateIngredient, null, 2) }] };
    },
  );

  server.tool(
    'remove_ingredient',
    'Permanently delete an ingredient and all its metadata (tags, category, etc.) from the pantry. To mark as out of stock instead, use update_ingredient with quantity 0.',
    {
      id: z.string().describe('Ingredient ID to delete'),
    },
    async ({ id }) => {
      await gql<{ deleteIngredient: boolean }>(
        `mutation($id: String!) { deleteIngredient(id: $id) }`,
        { id },
      );
      return { content: [{ type: 'text' as const, text: `Deleted ingredient ${id}` }] };
    },
  );

  server.tool(
    'update_ingredients',
    'Patch many pantry rows in one transaction. Each input is an id plus any fields to change; omitted fields are KEPT (unlike update_ingredient, which replaces quantity and unit), and an explicit null clears quantity, unit or expiresAt. Use it for review follow-ups: `{ id, quantity: 0, expiresAt: null }` for "out of stock" (the metadata-preserving delete), `{ id, expiresAt: "2026-11-20" }` to record a best-by date, `{ id, quantity: null }` to stop tracking a quantity. Fails as a whole if any id is unknown.',
    {
      inputs: z.array(z.object({
        id: z.string(),
        name: z.string().optional(),
        category: z.string().optional(),
        quantity: z.number().nullable().optional().describe('Omit to keep; null clears (untracked); 0 = out of stock.'),
        unit: z.string().nullable().optional().describe('Omit to keep; null clears.'),
        itemSize: z.number().optional(),
        itemSizeUnit: z.string().optional(),
        alwaysOnHand: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
        aliases: z.array(z.string()).optional(),
        barcode: z.string().optional(),
        productMeta: z.string().optional(),
        expiresAt: z.string().nullable().optional().describe(`${EXPIRES_AT_DOC} Omit to keep; null clears.`),
      })).min(1).describe('Patches, one per row'),
    },
    async ({ inputs }) => {
      const data = await gql<{ updateIngredients: unknown[] }>(
        `mutation($inputs: [IngredientPatchInput!]!) { updateIngredients(inputs: $inputs) { ${INGREDIENT_FIELDS} } }`,
        { inputs },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.updateIngredients, null, 2) }] };
    },
  );

  server.tool(
    'touch_ingredients',
    '"Still have it": mark pantry rows as freshly stocked (stockedAt and updatedAt = now) without changing quantities. The right answer when review_pantry flags something as expired, expiring or stale and the user says it is still fine — the estimate restarts from today.',
    { ids: z.array(z.string()).min(1).describe('Pantry row IDs') },
    async ({ ids }) => {
      const data = await gql<{ touchIngredients: { id: string; name: string; stockedAt: string }[] }>(
        `mutation($ids: [String!]!) { touchIngredients(ids: $ids) { id name stockedAt } }`,
        { ids },
      );
      return { content: [{ type: 'text' as const, text: `Marked ${data.touchIngredients.length} row(s) as still in stock: ${data.touchIngredients.map((r) => r.name).join(', ')}` }] };
    },
  );

  server.tool(
    'remove_ingredients',
    'Permanently delete many pantry rows at once, with all their metadata. Only when the user asked to delete or toss: to mark things as used up or out of stock, use update_ingredients with quantity 0, which keeps tags and barcode data. Returns how many were deleted.',
    { ids: z.array(z.string()).min(1).describe('Pantry row IDs to delete') },
    async ({ ids }) => {
      const data = await gql<{ deleteIngredients: number }>(
        `mutation($ids: [String!]!) { deleteIngredients(ids: $ids) }`,
        { ids },
      );
      return { content: [{ type: 'text' as const, text: `Deleted ${data.deleteIngredients} ingredient(s)` }] };
    },
  );

  server.tool(
    'merge_ingredients',
    'Merge duplicate pantry rows into one survivor (review_pantry suggests a survivorId per duplicate group, and the user can pick another). Quantities are summed when units and item sizes are compatible, tags and aliases are unioned, the merged rows\' names become aliases of the survivor so recipes keep matching, the earliest best-by and latest stockedAt win, and the merged rows are deleted. `unmergedQuantities` lists rows whose quantity could not be added (units that don\'t convert); tell the user.',
    {
      survivorId: z.string().describe('The row to keep'),
      mergeIds: z.array(z.string()).min(1).describe('Rows to merge into it and delete'),
    },
    async ({ survivorId, mergeIds }) => {
      const data = await gql<{ mergeIngredients: { ingredient: { name: string; quantity: number | null; unit: string | null; aliases: string[] }; mergedIds: string[]; unmergedQuantities: string[] } }>(
        `mutation($survivorId: String!, $mergeIds: [String!]!) {
          mergeIngredients(survivorId: $survivorId, mergeIds: $mergeIds) { ingredient { ${INGREDIENT_FIELDS} } mergedIds unmergedQuantities }
        }`,
        { survivorId, mergeIds },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.mergeIngredients, null, 2) }] };
    },
  );
}
