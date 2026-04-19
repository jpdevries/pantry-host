import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { gql } from '../graphql-client.js';
import { computeRecipeAllergens } from './allergens.js';

const RECIPE_SUMMARY = `id slug title description tags requiredCookware { name } servings prepTime cookTime source sourceUrl photoUrl queued lastMadeAt`;

function extFromContentType(ct: string): string {
  const lc = ct.toLowerCase();
  if (lc.includes('png')) return '.png';
  if (lc.includes('webp')) return '.webp';
  if (lc.includes('gif')) return '.gif';
  return '.jpg';
}

async function resolveCookwareIds(names: string[]): Promise<string[]> {
  if (!names.length) return [];
  const data = await gql<{ cookware: { id: string; name: string }[] }>(`{ cookware { id name } }`);
  const map = Object.fromEntries(data.cookware.map((c) => [c.name, c.id]));
  return names.map((n) => map[n]).filter(Boolean) as string[];
}
const RECIPE_FULL = `${RECIPE_SUMMARY} instructions ingredients { ingredientName quantity unit itemSize itemSizeUnit sourceRecipeId } groceryIngredients { ingredientName quantity unit itemSize itemSizeUnit }`;

export function registerRecipeTools(server: McpServer) {
  server.tool(
    'search_recipes',
    'Search recipes. Filter by title, tags, required cookware, queued status, or allergens to exclude. The allergen filter mirrors the recipe-detail AllergensLine — it considers both `contains-*` recipe tags and pantry-side OFF metadata, recursing through sub-recipes.',
    {
      title: z.string().optional().describe('Search by recipe title (partial match, case-insensitive)'),
      tags: z.array(z.string()).optional().describe('Filter by recipe tags (OR match). Examples: "dinner", "vegan", "bluesky" (AT Protocol imports)'),
      cookware: z.array(z.string()).optional().describe('Filter by required cookware (OR match)'),
      queued: z.boolean().optional().describe('Filter by queued status'),
      excludeAllergens: z.array(z.string()).optional().describe('Drop recipes whose allergen rollup intersects any of these substances. Substances are normalized lowercase ("peanuts", "tree nuts", "milk") — "Peanut" / "PEANUTS" also match. Useful for diet-aware planning ("nut-free dinners from what\'s on hand").'),
      kitchenSlug: z.string().optional().describe('Kitchen slug (default: home)'),
    },
    async (args) => {
      const { excludeAllergens, ...searchArgs } = args;
      const cookwareIds = searchArgs.cookware?.length ? await resolveCookwareIds(searchArgs.cookware) : undefined;
      const data = await gql<{ recipes: { id: string; slug: string }[] }>(
        `query($title: String, $tags: [String!], $cookware: [String!], $queued: Boolean, $kitchenSlug: String) {
          recipes(title: $title, tags: $tags, cookware: $cookware, queued: $queued, kitchenSlug: $kitchenSlug) { ${RECIPE_SUMMARY} }
        }`,
        { ...searchArgs, cookware: cookwareIds },
      );

      let recipes = data.recipes;
      // Allergen exclusion is a post-filter: aggregateAllergens needs the
      // full recipe + pantry context, which is too heavy to do server-side
      // in the recipes() resolver. Typical kitchens have ≤100 recipes;
      // running the helper per row is fast enough.
      if (excludeAllergens?.length) {
        const exclude = new Set(
          excludeAllergens.map((s) => s.trim().toLowerCase()),
        );
        const checks = await Promise.all(
          recipes.map(async (r) => {
            const { allergens } = await computeRecipeAllergens(r.id, args.kitchenSlug);
            const hit = allergens.some((a) => exclude.has(a.toLowerCase()));
            return hit ? null : r;
          }),
        );
        recipes = checks.filter((r): r is { id: string; slug: string } => r !== null);
      }

      return { content: [{ type: 'text' as const, text: JSON.stringify(recipes, null, 2) }] };
    },
  );

  server.tool(
    'get_recipe',
    'Get a recipe by ID or slug, including full instructions, direct `ingredients`, and `groceryIngredients` (the recursively-unfurled flat list — sub-recipes expanded to their constituents). Use `groceryIngredients` for nutrition / allergen introspection so warnings bubble up through the recipe chain. Tag any allergens explicitly with `contains-*` (e.g. `contains-tree-nuts`) for the strongest signal — those render with amber warning chips on the recipe detail page.',
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
    ingredientName: z.string().describe('Plain-text ingredient name (e.g. "ground beef", "olive oil"). NOT a pantry ingredient ID — recipe ingredients are freeform strings; pantry matching happens by name at render time.'),
    quantity: z.number().optional().describe('Quantity (count scales with servings)'),
    unit: z.string().optional().describe('Unit (e.g. cup, tbsp, whole, jar)'),
    itemSize: z.number().optional().describe('Per-item size — e.g. 16 for "2 16oz steaks" (quantity=2, unit="whole", itemSize=16, itemSizeUnit="oz"). Preserved when scaling servings.'),
    itemSizeUnit: z.string().optional().describe('Unit of the per-item size (e.g. "oz", "fl oz", "g")'),
    sourceRecipeId: z.string().optional().describe('ID of sub-recipe if this ingredient is another recipe'),
  });

  server.tool(
    'create_recipe',
    `Create a new recipe with ingredients in a SINGLE call. Always pass the complete ingredients array on creation — do not create the recipe first and try to attach ingredients in a follow-up update_recipe call.

IMPORTANT: Recipe ingredients are plain-text strings, NOT references to pantry ingredient IDs. Even when the user says "use my ground beef on hand," just include \`{ ingredientName: "ground beef", quantity: 0.5, unit: "lb" }\` in the array — pantry-side matching (have / need / running low) is computed at render time by name. Do NOT call search_pantry first to look up an ID; there is no ID linkage to populate.

Accepts at:// AT Protocol URIs in sourceUrl; tag with "bluesky" for federated imports. Tag with \`contains-*\` (e.g. \`contains-peanuts\`, \`contains-tree-nuts\`, \`contains-milk\`) when the recipe contains a known allergen — the FDA Top 9 are recognized and render as amber warning chips on the recipe detail page.`,
    {
      title: z.string().describe('Recipe title'),
      instructions: z.string().describe('Cooking instructions (full text)'),
      ingredients: z.array(recipeIngredientInput).describe('Recipe ingredients (plain-text names, freeform). Pass the FULL list — every ingredient mentioned in the conversation. Empty array means the recipe will have no ingredients.'),
      description: z.string().optional().describe('Short description'),
      servings: z.number().int().optional().describe('Number of servings (default: 2)'),
      prepTime: z.number().int().optional().describe('Prep time in minutes'),
      cookTime: z.number().int().optional().describe('Cook time in minutes'),
      tags: z.array(z.string()).optional().describe('Tags (e.g. dinner, vegan, quick). Use "bluesky" for AT Protocol imports.'),
      requiredCookware: z.array(z.string()).optional().describe('Required cookware names'),
      photoUrl: z.string().optional().describe('Photo URL. When omitted, card grids fall back to Pixabay if the user enabled it in Settings.'),
      sourceUrl: z.string().optional().describe('Source URL if imported. Accepts https:// and at:// AT Protocol URIs (e.g. at://did:plc:.../exchange.recipe.recipe/...). AT URIs are rendered as Bluesky links on detail pages.'),
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
    'Update an existing recipe. Only provide fields you want to change. Use `contains-*` tags to assert allergens (FDA Top 9) — they render as amber warning chips and surface in the AllergensLine union with pantry-side metadata.',
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
      ingredients: z.array(recipeIngredientInput).optional().describe('FULL replacement ingredient list (plain-text names, freeform — NOT pantry IDs). When provided, ALL existing recipe_ingredients rows are deleted and re-inserted from this array. Pass every ingredient you want on the recipe; omit the field entirely to leave the existing list untouched.'),
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
    'set_recipe_photo',
    `Attach a photo to a recipe. Pass EITHER \`imageUrl\` (https URL — the server will fetch the bytes) OR \`imageBase64\` (raw base64-encoded image bytes; data: URLs are accepted, the prefix is stripped). The image is uploaded to the self-hosted app's /api/upload endpoint, which saves it under public/uploads/{uuid}.{ext} and triggers sharp processing into 9 responsive variants (3 widths × WebP+JPEG+grayscale). The recipe's photoUrl is then updated to the local /uploads/... path so the SW caches it offline and <picture> srcset renders responsive images.

Use this instead of asking the user for a public upload URL — the upload endpoint lives at APP_URL (default http://localhost:3000) and is reachable from this MCP server. Returns the new photoUrl.`,
    {
      recipeId: z.string().describe('Recipe ID (UUID) to attach the photo to.'),
      imageUrl: z.string().optional().describe('HTTPS URL of the image. Server-side fetched; no need for the client to download first.'),
      imageBase64: z.string().optional().describe('Base64-encoded image bytes. Accepts raw base64 or a `data:image/...;base64,...` URL — the prefix is stripped automatically.'),
      filename: z.string().optional().describe('Optional original filename hint (used to pick the extension; defaults to .jpg).'),
    },
    async ({ recipeId, imageUrl, imageBase64, filename }) => {
      if (!imageUrl && !imageBase64) {
        throw new Error('Provide either imageUrl or imageBase64.');
      }
      if (imageUrl && imageBase64) {
        throw new Error('Provide only one of imageUrl or imageBase64, not both.');
      }

      // Resolve bytes + extension
      let bytes: Uint8Array;
      let ext = '.jpg';
      let contentType = 'image/jpeg';
      if (imageUrl) {
        const res = await fetch(imageUrl);
        if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${res.statusText}`);
        const buf = await res.arrayBuffer();
        bytes = new Uint8Array(buf);
        contentType = res.headers.get('content-type')?.split(';')[0]?.trim() || 'image/jpeg';
        const urlExt = imageUrl.match(/\.(jpe?g|png|webp|gif)(?:\?|#|$)/i)?.[1]?.toLowerCase();
        ext = urlExt ? `.${urlExt === 'jpeg' ? 'jpg' : urlExt}` : extFromContentType(contentType);
      } else {
        const stripped = imageBase64!.replace(/^data:([^;]+);base64,/, (_, ct) => {
          contentType = ct;
          return '';
        });
        bytes = Buffer.from(stripped, 'base64');
        ext = extFromContentType(contentType);
      }
      if (filename) {
        const fnExt = filename.match(/\.(jpe?g|png|webp|gif)$/i)?.[1]?.toLowerCase();
        if (fnExt) ext = `.${fnExt === 'jpeg' ? 'jpg' : fnExt}`;
      }

      // Rex 0.20.0 enforces ~2 MB on request bodies. When the fetched
      // image is larger, downscale to max-dimension 1500 px / JPEG q85
      // so the responsive pipeline can still do its work downstream.
      if (bytes.byteLength > 1_800_000) {
        const sharp = (await import('sharp')).default;
        const out = await sharp(bytes)
          .resize({ width: 1500, height: 1500, fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 85 })
          .toBuffer();
        bytes = new Uint8Array(out);
        ext = '.jpg';
        contentType = 'image/jpeg';
      }

      // POST multipart to the graphql-server's /upload mirror. Rex's
      // /api/upload route is broken; graphql-server (plain Node) works.
      const graphqlUrl = process.env.GRAPHQL_URL ?? 'http://localhost:4001/graphql';
      const uploadBase = graphqlUrl.replace(/\/graphql\/?$/, '');
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: contentType }), `upload${ext}`);
      const upRes = await fetch(`${uploadBase}/upload`, { method: 'POST', body: form });
      if (!upRes.ok) {
        const txt = await upRes.text().catch(() => '');
        throw new Error(`Upload failed: ${upRes.status} ${upRes.statusText} ${txt}`);
      }
      const { url: photoUrl } = (await upRes.json()) as { url: string };

      // Patch the recipe
      await gql(
        `mutation($id: String!, $photoUrl: String) { updateRecipe(id: $id, photoUrl: $photoUrl) { id photoUrl } }`,
        { id: recipeId, photoUrl },
      );
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ recipeId, photoUrl }, null, 2) }],
      };
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
