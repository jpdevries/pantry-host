/**
 * AT Protocol import page — self-hosted app (Rex).
 *
 * Catch-all route for /at/*. Parses the AT URI from window.location.pathname
 * (Rex's useRouter().query is unreliable in prod — gotcha #9), detects whether
 * the record is a recipe or a collection (menu), and dispatches to the
 * appropriate shared detail component.
 */
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import AtRecipeDetail from '@pantry-host/shared/components/AtRecipeDetail';
import AtMenuDetail from '@pantry-host/shared/components/AtMenuDetail';
import type { ParsedRecipe } from '@pantry-host/shared/bluesky';
import { gql } from '@/lib/gql';

const LEXICON_RECIPE = 'exchange.recipe.recipe';
const LEXICON_COLLECTION = 'exchange.recipe.collection';

/** Extract the AT URI path from the current URL pathname. */
function getAtPath(): string | null {
  if (typeof window === 'undefined') return null;
  const path = window.location.pathname;
  const match = path.match(/^\/at\/(.+)$/);
  return match ? match[1] : null;
}

/** Decode each path segment so URL-encoded colons (did%3Aplc%3A...) are restored. */
function decodeSegments(path: string): string {
  return path.replace(/^:\/\//, '').split('/').map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  }).join('/');
}

function buildAtUri(wildcard: string): string {
  return `at://${decodeSegments(wildcard)}`;
}

function parseAtPath(path: string): { ok: true; collection: string } | { ok: false; error: string } {
  const parts = decodeSegments(path).split('/');
  if (parts.length < 3) return { ok: false, error: 'Incomplete AT URI — expected did/collection/rkey' };
  const [did, collection, rkey] = parts;
  if (!did.startsWith('did:')) return { ok: false, error: `Invalid DID format: "${did}" — must start with did:` };
  if (!collection.includes('.')) return { ok: false, error: `Invalid collection format: "${collection}" — must be a valid NSID` };
  if (collection !== LEXICON_RECIPE && collection !== LEXICON_COLLECTION) {
    return { ok: false, error: `Unsupported record type: "${collection}" — only exchange.recipe.recipe and exchange.recipe.collection are supported` };
  }
  if (!rkey || rkey.length < 5) return { ok: false, error: `Invalid record key: "${rkey}"` };
  return { ok: true, collection };
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
const MENUS_QUERY = `{ menus { id slug } }`;

export default function AtImportAppPage() {
  const [wildcard, setWildcard] = useState<string | null>(null);

  useEffect(() => {
    setWildcard(getAtPath());
  }, []);

  if (wildcard === null) {
    return (
      <>
        <Head><title>Importing from AT Protocol | Pantry Host</title></Head>
        <div className="max-w-3xl mx-auto py-12 px-4">
          <p className="text-[var(--color-text-secondary)]">Loading…</p>
        </div>
      </>
    );
  }

  if (!wildcard) {
    return (
      <>
        <Head><title>Importing from AT Protocol | Pantry Host</title></Head>
        <div className="max-w-3xl mx-auto py-12 px-4">
          <p className="text-[var(--color-text-secondary)]">No AT URI provided.</p>
        </div>
      </>
    );
  }

  const parsed = parseAtPath(wildcard);
  if (!parsed.ok) {
    return (
      <>
        <Head><title>Invalid AT URI | Pantry Host</title></Head>
        <div className="max-w-3xl mx-auto py-12 px-4">
          <div className="card p-6">
            <p className="font-semibold mb-1">Invalid AT URI</p>
            <p className="text-sm text-[var(--color-text-secondary)]">{parsed.error}</p>
          </div>
        </div>
      </>
    );
  }

  const atUri = buildAtUri(wildcard);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const isMenu = parsed.collection === LEXICON_COLLECTION;

  return (
    <>
      <Head>
        <title>{isMenu ? 'Import Menu' : 'Import Recipe'} | Pantry Host</title>
        <meta name="description" content={isMenu ? 'Import a menu (collection) from the AT Protocol network into your Pantry Host.' : 'Import a recipe from the AT Protocol network into your Pantry Host.'} />
      </Head>
      {isMenu
        ? <MenuBranch atUri={atUri} shareUrl={shareUrl} />
        : <RecipeBranch atUri={atUri} shareUrl={shareUrl} />}
    </>
  );
}

// ── Recipe branch ──────────────────────────────────────────────────────

function RecipeBranch({ atUri, shareUrl }: { atUri: string; shareUrl: string }) {
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

// ── Menu branch ────────────────────────────────────────────────────────

function MenuBranch({ atUri, shareUrl }: { atUri: string; shareUrl: string }) {
  const checkDuplicate = useCallback(async (_sourceUrl: string) => {
    try {
      await gql<{ menus: { id: string; slug: string }[] }>(MENUS_QUERY);
    } catch { /* noop */ }
    return null;
  }, []);

  const renderMenuLink = useCallback((slug: string, children: React.ReactNode) => (
    <a href={`/menus/${slug}#stage`}>{children}</a>
  ), []);

  return (
    <AtMenuDetail
      atUri={atUri}
      shareUrl={shareUrl}
      menuBasePath="/menus"
      recipeAtBase="/at"
      gql={gql}
      checkDuplicate={checkDuplicate}
      renderMenuLink={renderMenuLink}
    />
  );
}
