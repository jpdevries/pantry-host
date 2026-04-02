import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gql } from '../graphql-client.js';

export function registerResources(server: McpServer) {
  server.resource(
    'pantry-ingredients',
    'pantry://ingredients',
    { description: 'Current pantry inventory — all ingredients across all kitchens' },
    async () => {
      const data = await gql<{ ingredients: unknown[] }>(
        `{ ingredients { id name category quantity unit alwaysOnHand tags } }`,
      );
      return {
        contents: [{
          uri: 'pantry://ingredients',
          mimeType: 'application/json',
          text: JSON.stringify(data.ingredients, null, 2),
        }],
      };
    },
  );

  server.resource(
    'pantry-recipes',
    'pantry://recipes',
    { description: 'All recipes — titles, tags, and metadata' },
    async () => {
      const data = await gql<{ recipes: unknown[] }>(
        `{ recipes { id slug title description tags servings prepTime cookTime requiredCookware { name } queued lastMadeAt } }`,
      );
      return {
        contents: [{
          uri: 'pantry://recipes',
          mimeType: 'application/json',
          text: JSON.stringify(data.recipes, null, 2),
        }],
      };
    },
  );

  server.resource(
    'pantry-cookware',
    'pantry://cookware',
    { description: 'All cookware items' },
    async () => {
      const data = await gql<{ cookware: unknown[] }>(
        `{ cookware { id name brand tags } }`,
      );
      return {
        contents: [{
          uri: 'pantry://cookware',
          mimeType: 'application/json',
          text: JSON.stringify(data.cookware, null, 2),
        }],
      };
    },
  );

  server.resource(
    'pantry-menus',
    'pantry://menus',
    { description: 'All menus with recipe assignments' },
    async () => {
      const data = await gql<{ menus: unknown[] }>(
        `{ menus { id slug title description active category recipes { course recipe { id title } } } }`,
      );
      return {
        contents: [{
          uri: 'pantry://menus',
          mimeType: 'application/json',
          text: JSON.stringify(data.menus, null, 2),
        }],
      };
    },
  );

  server.resource(
    'pantry-kitchens',
    'pantry://kitchens',
    { description: 'All kitchens' },
    async () => {
      const data = await gql<{ kitchens: unknown[] }>(
        `{ kitchens { id slug name } }`,
      );
      return {
        contents: [{
          uri: 'pantry://kitchens',
          mimeType: 'application/json',
          text: JSON.stringify(data.kitchens, null, 2),
        }],
      };
    },
  );
}
