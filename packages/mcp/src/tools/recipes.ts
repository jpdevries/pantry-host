import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gql } from '../graphql-client.js';

const RECIPE_SUMMARY = `id slug title description tags requiredCookware { name } servings prepTime cookTime source sourceUrl photoUrl queued lastMadeAt`;

async function resolveCookwareIds(names: string[]): Promise<string[]> {
  if (!names.length) return [];
  const data = await gql<{ cookware: { id: string; name: string }[] }>(`{ cookware { id name } }`);
  const map = Object.fromEntries(data.cookware.map((c) => [c.name, c.id]));
  return names.map((n) => map[n]).filter(Boolean) as string[];
}
const RECIPE_FULL = `${RECIPE_SUMMARY} instructions ingredients { ingredientName quantity unit sourceRecipeId } groceryIngredients { ingredientName quantity unit }`;

export function registerRecipeTools(server: McpServer) {
  server.tool(
    'search_recipes',
    'Search recipes. Filter by tags, required cookware, or queued status.',
    {
      tags: z.array(z.string()).optional().describe('Filter by recipe tags (OR match)'),
      cookware: z.array(z.string()).optional().describe('Filter by required cookware (OR match)'),
      queued: z.boolean().optional().describe('Filter by queued status'),
      kitchenSlug: z.string().optional().describe('Kitchen slug (default: home)'),
    },
    async (args) => {
      const cookwareIds = args.cookware?.length ? await resolveCookwareIds(args.cookware) : undefined;
      const data = await gql<{ recipes: unknown[] }>(
        `query($tags: [String!], $cookware: [String!], $queued: Boolean, $kitchenSlug: String) {
          recipes(tags: $tags, cookware: $cookware, queued: $queued, kitchenSlug: $kitchenSlug) { ${RECIPE_SUMMARY} }
        }`,
        { ...args, cookware: cookwareIds },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.recipes, null, 2) }] };
    },
  );

  server.tool(
    'get_recipe',
    'Get a recipe by ID or slug, including full instructions and ingredients.',
    {
      id: z.string().describe('Recipe ID (UUID) or slug'),
    },
    async ({ id }) => {
      const data = await gql<{ recipe: unknown }>(
        `query($id: String!) { recipe(id: $id) { ${RECIPE_FULL} } }`,
        { id },
      );
      if (!data.recipe) return { content: [{ type: 'text' as const, text: 'Recipe not found' }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.recipe, null, 2) }] };
    },
  );

  const recipeIngredientInput = z.object({
    ingredientName: z.string().describe('Ingredient name'),
    quantity: z.number().optional().describe('Quantity'),
    unit: z.string().optional().describe('Unit'),
    sourceRecipeId: z.string().optional().describe('ID of sub-recipe if this ingredient is another recipe'),
  });

  server.tool(
    'create_recipe',
    'Create a new recipe with ingredients.',
    {
      title: z.string().describe('Recipe title'),
      instructions: z.string().describe('Cooking instructions (full text)'),
      ingredients: z.array(recipeIngredientInput).describe('Recipe ingredients'),
      description: z.string().optional().describe('Short description'),
      servings: z.number().int().optional().describe('Number of servings (default: 2)'),
      prepTime: z.number().int().optional().describe('Prep time in minutes'),
      cookTime: z.number().int().optional().describe('Cook time in minutes'),
      tags: z.array(z.string()).optional().describe('Tags (e.g. dinner, vegan, quick)'),
      requiredCookware: z.array(z.string()).optional().describe('Required cookware names'),
      photoUrl: z.string().optional().describe('Photo URL'),
      sourceUrl: z.string().optional().describe('Source URL if imported'),
      kitchenSlug: z.string().optional().describe('Kitchen slug (default: home)'),
    },
    async (args) => {
      const requiredCookwareIds = args.requiredCookware ? await resolveCookwareIds(args.requiredCookware) : undefined;
      const data = await gql<{ createRecipe: unknown }>(
        `mutation(
          $title: String!, $instructions: String!, $ingredients: [RecipeIngredientInput!]!,
          $description: String, $servings: Int, $prepTime: Int, $cookTime: Int,
          $tags: [String!], $requiredCookwareIds: [String!], $photoUrl: String, $sourceUrl: String, $kitchenSlug: String
        ) {
          createRecipe(
            title: $title, instructions: $instructions, ingredients: $ingredients,
            description: $description, servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
            tags: $tags, requiredCookwareIds: $requiredCookwareIds, photoUrl: $photoUrl, sourceUrl: $sourceUrl, kitchenSlug: $kitchenSlug
          ) { ${RECIPE_SUMMARY} }
        }`,
        { ...args, requiredCookwareIds },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.createRecipe, null, 2) }] };
    },
  );

  server.tool(
    'update_recipe',
    'Update an existing recipe. Only provide fields you want to change.',
    {
      id: z.string().describe('Recipe ID'),
      title: z.string().optional(),
      description: z.string().optional(),
      instructions: z.string().optional(),
      servings: z.number().int().optional(),
      prepTime: z.number().int().optional(),
      cookTime: z.number().int().optional(),
      tags: z.array(z.string()).optional(),
      requiredCookware: z.array(z.string()).optional(),
      photoUrl: z.string().optional(),
      ingredients: z.array(recipeIngredientInput).optional().describe('Full replacement ingredient list'),
    },
    async (args) => {
      const requiredCookwareIds = args.requiredCookware ? await resolveCookwareIds(args.requiredCookware) : undefined;
      const data = await gql<{ updateRecipe: unknown }>(
        `mutation(
          $id: String!, $title: String, $description: String, $instructions: String,
          $servings: Int, $prepTime: Int, $cookTime: Int, $tags: [String!],
          $requiredCookwareIds: [String!], $photoUrl: String, $ingredients: [RecipeIngredientInput!]
        ) {
          updateRecipe(
            id: $id, title: $title, description: $description, instructions: $instructions,
            servings: $servings, prepTime: $prepTime, cookTime: $cookTime, tags: $tags,
            requiredCookwareIds: $requiredCookwareIds, photoUrl: $photoUrl, ingredients: $ingredients
          ) { ${RECIPE_SUMMARY} }
        }`,
        { ...args, requiredCookwareIds },
      );
      return { content: [{ type: 'text' as const, text: JSON.stringify(data.updateRecipe, null, 2) }] };
    },
  );

  server.tool(
    'delete_recipe',
    'Delete a recipe.',
    { id: z.string().describe('Recipe ID') },
    async ({ id }) => {
      await gql(`mutation($id: String!) { deleteRecipe(id: $id) }`, { id });
      return { content: [{ type: 'text' as const, text: `Deleted recipe ${id}` }] };
    },
  );

  server.tool(
    'mark_recipe_cooked',
    'Record that a recipe was cooked (sets lastMadeAt to now).',
    { id: z.string().describe('Recipe ID') },
    async ({ id }) => {
      const data = await gql<{ completeRecipe: { title: string; lastMadeAt: string } }>(
        `mutation($id: String!) { completeRecipe(id: $id) { title lastMadeAt } }`,
        { id },
      );
      return { content: [{ type: 'text' as const, text: `Marked "${data.completeRecipe.title}" as cooked at ${data.completeRecipe.lastMadeAt}` }] };
    },
  );

  server.tool(
    'queue_recipe',
    'Toggle a recipe\'s queued status (mark it for cooking or unmark it).',
    { id: z.string().describe('Recipe ID') },
    async ({ id }) => {
      const data = await gql<{ toggleRecipeQueued: { title: string; queued: boolean } }>(
        `mutation($id: String!) { toggleRecipeQueued(id: $id) { title queued } }`,
        { id },
      );
      const status = data.toggleRecipeQueued.queued ? 'queued' : 'unqueued';
      return { content: [{ type: 'text' as const, text: `"${data.toggleRecipeQueued.title}" is now ${status}` }] };
    },
  );
}
