import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gql } from '../graphql-client.js';

const INGREDIENT_FIELDS = `id name category quantity unit alwaysOnHand tags createdAt`;

export function registerIngredientTools(server: McpServer) {
  server.tool(
    'search_pantry',
    'Search pantry ingredients. Optionally filter by name, tags, or kitchen.',
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
    'Add an ingredient to the pantry.',
    {
      name: z.string().describe('Ingredient name'),
      category: z.enum(['vegetables', 'fruit', 'fresh herbs', 'dairy', 'meat & poultry', 'seafood & fish', 'eggs', 'tofu & tempeh', 'legumes & pulses', 'nuts & seeds', 'plant-based milks', 'dry goods & grains', 'canned & jarred', 'condiments & sauces', 'herbs & spices', 'oils & vinegars', 'baking', 'frozen', 'deli & charcuterie', 'beverages', 'snacks', 'other']).optional().describe('Category'),
      quantity: z.number().optional().describe('Quantity'),
      unit: z.string().optional().describe('Unit (e.g. cup, oz, lb, whole)'),
      alwaysOnHand: z.boolean().optional().describe('If true, never track quantity'),
      tags: z.array(z.string()).optional().describe('Tags'),
      kitchenSlug: z.string().optional().describe('Kitchen slug (default: home)'),
    },
    async (args) => {
      const data = await gql<{ addIngredient: unknown }>(
        `mutation($name: String!, $category: String, $quantity: Float, $unit: String, $alwaysOnHand: Boolean, $tags: [String!], $kitchenSlug: String) {
          addIngredient(name: $name, category: $category, quantity: $quantity, unit: $unit, alwaysOnHand: $alwaysOnHand, tags: $tags, kitchenSlug: $kitchenSlug) { ${INGREDIENT_FIELDS} }
        }`,
        args,
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.addIngredient, null, 2) }] };
    },
  );

  server.tool(
    'add_ingredients',
    'Bulk-add multiple ingredients to the pantry.',
    {
      ingredients: z.array(z.object({
        name: z.string(),
        category: z.string().optional(),
        quantity: z.number().optional(),
        unit: z.string().optional(),
        alwaysOnHand: z.boolean().optional(),
        tags: z.array(z.string()).optional(),
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
    'Update an existing pantry ingredient. To mark as out of stock, set quantity to 0 — this preserves tags (like harvest locations) and other metadata. Prefer this over remove_ingredient when the user runs out of something.',
    {
      id: z.string().describe('Ingredient ID'),
      name: z.string().optional().describe('New name'),
      category: z.string().optional().describe('New category'),
      quantity: z.number().optional().describe('New quantity. Set to 0 to mark as out of stock while keeping tags and metadata.'),
      unit: z.string().optional().describe('New unit'),
      alwaysOnHand: z.boolean().optional().describe('Mark as always on hand'),
      tags: z.array(z.string()).optional().describe('New tags (e.g. harvest location tags like costco, farmers-market)'),
    },
    async (args) => {
      const data = await gql<{ updateIngredient: unknown }>(
        `mutation($id: String!, $name: String, $category: String, $quantity: Float, $unit: String, $alwaysOnHand: Boolean, $tags: [String!]) {
          updateIngredient(id: $id, name: $name, category: $category, quantity: $quantity, unit: $unit, alwaysOnHand: $alwaysOnHand, tags: $tags) { ${INGREDIENT_FIELDS} }
        }`,
        args,
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
}
