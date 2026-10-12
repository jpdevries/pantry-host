/**
 * GraphQL query behind the recipes index grid (`/recipes` and
 * `/kitchens/:kitchen/recipes`).
 *
 * This is a contract between two runtimes, so it lives here instead of in
 * the page component:
 *
 * - packages/app — `RecipesIndexPage` runs it client-side, and the Rex
 *   `getServerSideProps` on both index routes runs it to seed
 *   `initialRecipes`.
 * - packages/server (Rust) — `src/frontend.rs` `include_str!`s this file and
 *   executes the same query in-process to fill `__REX_DATA__` in the
 *   embedded SPA shell, so the page gets identical `initialRecipes` props
 *   without a JS runtime on the server.
 *
 * The Rust side extracts the template literal assigned by the export below
 * (it anchors on the full `export const …` declaration). Keep it a single
 * plain template literal: no `${}` interpolation and no backticks inside the
 * query.
 */
export const RECIPES_INDEX_QUERY = `
  query Recipes($kitchenSlug: String) {
    recipes(kitchenSlug: $kitchenSlug) { id slug title cookTime prepTime servings source sourceUrl tags photoUrl queued }
  }
`;
