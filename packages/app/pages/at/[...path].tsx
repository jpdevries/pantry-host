/**
 * AT Protocol recipe import page — self-hosted app (Rex).
 *
 * Catch-all route for /at/*. Parses the AT URI from window.location.pathname
 * (Rex's useRouter().query is unreliable in prod — gotcha #9).
 */
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AtRecipeDetail from '@pantry-host/shared/components/AtRecipeDetail';
import type { ParsedRecipe } from '@pantry-host/shared/bluesky';
import { gql } from '@/lib/gql';

/** Extract the AT URI path from the current URL pathname. */
function getAtPath(): string | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  // Strip /at/ prefix
  const match = path.match(/^\/at\/(.+)$/);
  return match ? match[1] : null;
}

function buildAtUri(wildcard: string): string {
  return `at://${wildcard.replace(/^:\/\//, '')}`;
}

function validateAtUri(path: string): string | null {
  const parts = path.replace(/^:\/\//, '').split('/');
  if (parts.length < 3) return 'Incomplete AT URI — expected did/collection/rkey';
  const [did, collection] = parts;
  if (!did.startsWith('did:')) return `Invalid DID format: "${did}" — must start with did:`;
  if (!collection.includes('.')) return `Invalid collection format: "${collection}" — must be a valid NSID`;
  if (collection !== 'exchange.recipe.recipe') return `Unsupported record type: "${collection}" — only recipes can be imported`;
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

export default function AtImportAppPage() {
  const [wildcard, setWildcard] = useState<string | null>(null);

  useEffect(() => {
    setWildcard(getAtPath());
  }, []);

  if (wildcard === null) {
    return (
      <>
        <Head><title>Import Recipe | Pantry Host</title></Head>
        <div className="max-w-3xl mx-auto py-12 px-4">
          <p className="text-[var(--color-text-secondary)]">Loading…</p>
        </div>
      </>
    );
  }

  if (!wildcard) {
    return (
      <>
        <Head><title>Import Recipe | Pantry Host</title></Head>
        <div className="max-w-3xl mx-auto py-12 px-4">
          <p className="text-[var(--color-text-secondary)]">No AT URI provided.</p>
        </div>
      </>
    );
  }

  const validationError = validateAtUri(wildcard);
  if (validationError) {
    return (
      <>
        <Head><title>Invalid AT URI | Pantry Host</title></Head>
        <div className="max-w-3xl mx-auto py-12 px-4">
          <div className="card p-6">
            <p className="font-semibold mb-1">Invalid AT URI</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{validationError}</p>
          </div>
        </div>
      </>
    );
  }

  const atUri = buildAtUri(wildcard);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  return (
    <>
      <Head>
        <title>Import Recipe | Pantry Host</title>
        <meta name="description" content="Import a recipe from the AT Protocol network into your Pantry Host." />
      </Head>
      <AtImportInner atUri={atUri} shareUrl={shareUrl} />
    </>
  );
}

function AtImportInner({ atUri, shareUrl }: { atUri: string; shareUrl: string }) {
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
    <a href={`/recipes/${slug}#stage`}>{children}</a>
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
