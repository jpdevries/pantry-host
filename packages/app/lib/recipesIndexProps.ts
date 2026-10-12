import { RECIPES_INDEX_QUERY } from '@pantry-host/shared/queries/recipes-index';
import type { RecipeIndexItem } from '@/components/pages/RecipesIndexPage';

export interface RecipesIndexProps {
  initialRecipes?: RecipeIndexItem[];
}

// Shared getServerSideProps body for `/recipes` and
// `/kitchens/:kitchen/recipes`. Same transport rules as
// pages/recipes/[slug].tsx: go through the standalone GraphQL server over
// HTTP (REX_INTERNAL_ORIGIN must allow http://127.0.0.1:4001), and never
// block the render for more than 5s. On any failure return no props; the
// page falls back to its client-side fetch.
//
// The Rust server fills the same `initialRecipes` prop for its embedded SPA
// shell (packages/server/src/frontend.rs), so the page can't tell which
// backend rendered it.
export async function getRecipesIndexProps(kitchenSlug: string): Promise<{ props: RecipesIndexProps }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('http://127.0.0.1:4001/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: RECIPES_INDEX_QUERY, variables: { kitchenSlug } }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const snippet = (await res.text()).slice(0, 200);
      console.error('[recipes index] GSSP non-OK response for kitchen=%s status=%d body=%s', kitchenSlug, res.status, snippet);
      return { props: {} };
    }
    const body = (await res.json()) as { data?: { recipes?: RecipeIndexItem[] }; errors?: unknown };
    if (body.errors || !body.data?.recipes) {
      console.error('[recipes index] GSSP GraphQL errors for kitchen=%s: %s', kitchenSlug, JSON.stringify(body.errors));
      return { props: {} };
    }
    return { props: { initialRecipes: body.data.recipes } };
  } catch (e) {
    console.error(
      '[recipes index] GSSP fetch failed for kitchen=%s: %s',
      kitchenSlug,
      e instanceof Error ? (e.stack ?? e.message) : String(e),
    );
    return { props: {} };
  } finally {
    clearTimeout(timer);
  }
}
