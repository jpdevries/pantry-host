/**
 * Bluesky / AT Protocol import helper.
 *
 * Lives alongside `bluesky.ts` (the read-only XRPC client) but is kept
 * separate because this module is a WRITE-side helper: it needs a gql
 * client supplied by the caller, since the app and web packages wire up
 * their mutations differently (app → HTTP to :4001, web → graphql-js
 * locally against PGlite).
 *
 * Currently exposes one helper: `importBlueskyCollection` — fetch a
 * collection (menu) from the AT network, create each member recipe in
 * the local pantry, then create the menu with pointers to those recipes.
 * Used both by the Bluesky Menus feed's Bulk Import flow AND the
 * menu detail page's single-menu "Import to your pantry" CTA, so the
 * two flows can never drift out of sync.
 */

import {
  fetchBlueskyCollection,
  fetchBlueskyRecipe,
  type ParsedRecipe,
} from './bluesky';

type GqlFn = <T>(query: string, variables?: Record<string, unknown>) => Promise<T>;

// Both mutations accept an optional $kitchenSlug. The web package (PGlite)
// ignores it — its schema has the arg but no multi-kitchen semantics — so
// passing null works in both packages.
const CREATE_RECIPE_MUTATION = `mutation(
  $title: String!, $instructions: String!, $ingredients: [RecipeIngredientInput!]!,
  $description: String, $servings: Int, $prepTime: Int, $cookTime: Int,
  $tags: [String!], $photoUrl: String, $sourceUrl: String, $kitchenSlug: String
) {
  createRecipe(
    title: $title, instructions: $instructions, ingredients: $ingredients,
    description: $description, servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
    tags: $tags, photoUrl: $photoUrl, sourceUrl: $sourceUrl, kitchenSlug: $kitchenSlug
  ) { id slug }
}`;

const CREATE_MENU_MUTATION = `mutation(
  $title: String!, $description: String, $recipes: [MenuRecipeInput!]!, $kitchenSlug: String
) {
  createMenu(title: $title, description: $description, recipes: $recipes, kitchenSlug: $kitchenSlug) { id slug }
}`;

export interface ImportCollectionResult {
  menuSlug: string;
  menuId: string;
  recipeIds: string[];
  /** URIs that failed to fetch (e.g. deleted or unreachable on author's PDS). */
  skippedUris: string[];
}

export interface ImportCollectionProgress {
  /** 0-based index of the current step. */
  done: number;
  /** Total step count = member recipes + 1 (the menu itself). */
  total: number;
  /** Human-readable label for the current step. */
  label: string;
}

/**
 * Import a Bluesky collection (menu) into Pantry Host.
 *
 * Steps, each reported via onProgress:
 *   1..N — fetch + create each member recipe
 *   N+1  — create the menu record referencing the created recipes
 *
 * Recipes that fail to fetch are skipped (not fatal) and their URIs
 * are returned in `skippedUris` so the caller can surface them.
 */
export async function importBlueskyCollection(opts: {
  atUri: string;
  gql: GqlFn;
  /** Optional kitchen slug (app package, multi-kitchen support). Web package can omit. */
  kitchenSlug?: string | null;
  onProgress?: (progress: ImportCollectionProgress) => void;
}): Promise<ImportCollectionResult> {
  const { atUri, gql, kitchenSlug = null, onProgress } = opts;

  // Step 0: fetch the collection envelope so we know how many recipes
  // we're processing (+ the name/description we need for createMenu).
  const collection = await fetchBlueskyCollection(atUri);
  const total = collection.recipeUris.length + 1;

  const recipeIds: string[] = [];
  const skippedUris: string[] = [];

  for (let i = 0; i < collection.recipeUris.length; i++) {
    const recipeUri = collection.recipeUris[i];
    onProgress?.({ done: i, total, label: `Fetching recipe ${i + 1} of ${collection.recipeUris.length}…` });
    let recipe: ParsedRecipe;
    try {
      recipe = await fetchBlueskyRecipe(recipeUri);
    } catch (err) {
      // Recipe may have been deleted from the author's PDS. Skip it and
      // continue — the menu can still be created with the remaining
      // recipes.
      console.warn('[bluesky-import] Failed to fetch', recipeUri, err);
      skippedUris.push(recipeUri);
      continue;
    }

    try {
      const result = await gql<{ createRecipe: { id: string; slug: string } }>(
        CREATE_RECIPE_MUTATION,
        {
          title: recipe.title,
          description: recipe.description ?? null,
          instructions: recipe.instructions,
          servings: recipe.servings ?? null,
          prepTime: recipe.prepTime ?? null,
          cookTime: recipe.cookTime ?? null,
          tags: recipe.tags ?? [],
          photoUrl: recipe.photoUrl ?? null,
          sourceUrl: recipe.sourceUrl,
          ingredients: recipe.ingredients,
          kitchenSlug,
        },
      );
      recipeIds.push(result.createRecipe.id);
    } catch (err) {
      console.warn('[bluesky-import] Failed to create recipe', recipeUri, err);
      skippedUris.push(recipeUri);
    }
  }

  onProgress?.({ done: total - 1, total, label: 'Creating menu…' });
  const menuResult = await gql<{ createMenu: { id: string; slug: string } }>(
    CREATE_MENU_MUTATION,
    {
      title: collection.name,
      description: collection.description ?? null,
      recipes: recipeIds.map((recipeId) => ({ recipeId })),
      kitchenSlug,
    },
  );

  onProgress?.({ done: total, total, label: 'Done.' });

  return {
    menuId: menuResult.createMenu.id,
    menuSlug: menuResult.createMenu.slug,
    recipeIds,
    skippedUris,
  };
}
