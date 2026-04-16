/**
 * AT Protocol recipe import page — web package (PGlite).
 *
 * Handles /at/* routes. Parses the AT URI from the URL path,
 * fetches the recipe from the AT Protocol network, and offers
 * a one-click import into the user's local PGlite database.
 */
import { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import AtRecipeDetail from '@pantry-host/shared/components/AtRecipeDetail';
import type { ParsedRecipe } from '@pantry-host/shared/bluesky';
import { gql } from '@/lib/gql';

/** Decode each path segment so URL-encoded colons (did%3Aplc%3A...) are restored. */
function decodeSegments(path: string): string {
  return path.replace(/^:\/\//, '').split('/').map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  }).join('/');
}

/** Reconstruct the AT URI from the wildcard path segments. */
function buildAtUri(wildcard: string): string {
  return `at://${decodeSegments(wildcard)}`;
}

/** Validate the AT URI components and return an error message or null. */
function validateAtUri(path: string): string | null {
  const parts = decodeSegments(path).split('/');
  if (parts.length < 3) return 'Incomplete AT URI — expected did/collection/rkey';
  const [did, collection, rkey] = parts;
  if (!did.startsWith('did:')) return `Invalid DID format: "${did}" — must start with did:`;
  if (!collection.includes('.')) return `Invalid collection format: "${collection}" — must be a valid NSID`;
  if (collection !== 'exchange.recipe.recipe') return `Unsupported record type: "${collection}" — only recipes can be imported`;
  if (!rkey || rkey.length < 5) return `Invalid record key: "${rkey}"`;
  return null;
}

const CREATE_RECIPE = `
  mutation CreateRecipe(
    $title: String!, $description: String, $instructions: String!,
    $servings: Int, $prepTime: Int, $cookTime: Int,
    $tags: [String!], $photoUrl: String, $sourceUrl: String,
    $ingredients: [RecipeIngredientInput!]!
  ) {
    createRecipe(
      title: $title, description: $description, instructions: $instructions,
      servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
      tags: $tags, photoUrl: $photoUrl, sourceUrl: $sourceUrl,
      ingredients: $ingredients
    ) { id slug }
  }
`;

const RECIPES_QUERY = `{ recipes { id slug sourceUrl } }`;

export default function AtImportPage() {
  const { '*': wildcard } = useParams();

  if (!wildcard) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <p className="text-[var(--color-text-secondary)]">No AT URI provided.</p>
      </div>
    );
  }

  const validationError = validateAtUri(wildcard);
  if (validationError) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="card p-6">
          <p className="font-semibold mb-1">Invalid AT URI</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{validationError}</p>
        </div>
      </div>
    );
  }

  const atUri = buildAtUri(wildcard);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  const handleImport = useCallback(async (recipe: ParsedRecipe) => {
    const data = await gql<{ createRecipe: { id: string; slug: string } }>(CREATE_RECIPE, {
      title: recipe.title,
      description: recipe.description ?? null,
      instructions: recipe.instructions,
      servings: recipe.servings ?? null,
      prepTime: recipe.prepTime ?? null,
      cookTime: recipe.cookTime ?? null,
      tags: recipe.tags,
      photoUrl: recipe.photoUrl ?? null,
      sourceUrl: recipe.sourceUrl,
      ingredients: recipe.ingredients.map((i) => ({
        ingredientName: i.ingredientName,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
      })),
    });
    return { slug: data.createRecipe.slug };
  }, []);

  const checkDuplicate = useCallback(async (sourceUrl: string) => {
    const data = await gql<{ recipes: { id: string; slug: string; sourceUrl: string | null }[] }>(RECIPES_QUERY);
    const match = data.recipes.find((r) => r.sourceUrl === sourceUrl);
    return match?.slug ?? null;
  }, []);

  const renderRecipeLink = useCallback((slug: string, children: React.ReactNode) => (
    <Link to={`/recipes/${slug}#stage`}>{children}</Link>
  ), []);

  return (
    <AtRecipeDetail
      atUri={atUri}
      shareUrl={shareUrl}
      recipeBasePath="/recipes"
      onImport={handleImport}
      checkDuplicate={checkDuplicate}
      renderRecipeLink={renderRecipeLink}
    />
  );
}
