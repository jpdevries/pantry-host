import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gql } from '../graphql-client.js';

export function registerGenerateTools(server: McpServer) {
  // Only register AI tool if the GraphQL server has an AI key configured.
  // The tool itself doesn't need the key — the GraphQL server handles that.
  // We register it unconditionally and let the server return a clear error if no key is set.
  server.tool(
    'generate_recipes',
    'EXPERIMENTAL. Use AI to invent 3 recipes from scratch based on current pantry ingredients and cookware, and save them to the recipe box. Results are untested ideas to riff on, not reliable recipes, so set expectations when you present them. To help a user cook from what they have, prefer adapting their existing recipes instead: find candidates with search_recipes and get_recipe, then scale, substitute, or rework them with update_recipe or create_recipe. Requires AI_API_KEY to be configured on the PantryHost server. May take 15-30 seconds. Recipes without a photoUrl fall back to Pixabay on card grids when the user has enabled it in Settings.',
    {},
    async () => {
      const data = await gql<{ generateRecipes: Array<{ id: string; title: string; tags: string[] }> }>(
        `mutation { generateRecipes { id slug title description tags servings prepTime cookTime } }`,
      );
      return {
        content: [{
          type: 'text' as const,
          text: `Generated ${data.generateRecipes.length} recipes:\n${data.generateRecipes.map((r) => `- ${r.title} (${r.tags.join(', ')})`).join('\n')}`,
        }],
      };
    },
  );
}
