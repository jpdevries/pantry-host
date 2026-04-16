/**
 * AT Protocol import page — web package (PGlite).
 *
 * Handles /at/* routes. Parses the AT URI from the URL path, detects
 * whether the record is a recipe or a collection (menu), and dispatches
 * to the appropriate shared detail component.
 */
import { useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import AtRecipeDetail from '@pantry-host/shared/components/AtRecipeDetail';
import AtMenuDetail from '@pantry-host/shared/components/AtMenuDetail';
import type { ParsedRecipe } from '@pantry-host/shared/bluesky';
import { gql } from '@/lib/gql';

const LEXICON_RECIPE = 'exchange.recipe.recipe';
const LEXICON_COLLECTION = 'exchange.recipe.collection';

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

/**
 * Validate the AT URI components. Returns either the collection type
 * (as a string) on success, or an error message on failure.
 */
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

export default function AtImportPage() {
  const { '*': wildcard } = useParams();

  if (!wildcard) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <p className="text-[var(--color-text-secondary)]">No AT URI provided.</p>
      </div>
    );
  }

  const parsed = parseAtPath(wildcard);
  if (!parsed.ok) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="card p-6">
          <p className="font-semibold mb-1">Invalid AT URI</p>
          <p className="text-sm text-[var(--color-text-secondary)]">{parsed.error}</p>
        </div>
      </div>
    );
  }

  const atUri = buildAtUri(wildcard);
  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';

  if (parsed.collection === LEXICON_COLLECTION) {
    return <MenuBranch atUri={atUri} shareUrl={shareUrl} />;
  }
  return <RecipeBranch atUri={atUri} shareUrl={shareUrl} />;
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

// ── Menu branch ────────────────────────────────────────────────────────

function MenuBranch({ atUri, shareUrl }: { atUri: string; shareUrl: string }) {
  // Duplicate check for menus is best-effort: menus don't currently have
  // a sourceUrl column, so we can only match if a prior import stored
  // the AT URI as the slug seed. For now we always return null — the
  // detail page falls back to the Import CTA, and the server dedupes
  // recipe children by sourceUrl inside importBlueskyCollection.
  const checkDuplicate = useCallback(async (_sourceUrl: string) => {
    try {
      await gql<{ menus: { id: string; slug: string }[] }>(MENUS_QUERY);
    } catch { /* noop */ }
    return null;
  }, []);

  const renderMenuLink = useCallback((slug: string, children: React.ReactNode) => (
    <Link to={`/menus/${slug}#stage`}>{children}</Link>
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
