/**
 * Server-seeded page data: typed access to `page-data.json`.
 *
 * The JSON is the contract between the two runtimes that render pages:
 * - packages/app (Rex): each listed route's getServerSideProps runs the
 *   route's query and returns `{ initialData }`; the page component runs the
 *   same query client-side to refresh.
 * - packages/server (Rust): `src/frontend.rs` `include_str!`s the JSON and
 *   runs the same query in-process to fill `__REX_DATA__` in the SPA shell.
 *
 * Both sides look rows up by the Rex page pattern (e.g. `/recipes/:slug`),
 * so they route identically. Keep queries free of interpolation; they live
 * in JSON precisely so the Rust binary can embed them verbatim.
 */
import pageData from './page-data.json';

export type PageQueryName =
  | 'home'
  | 'recipesIndex'
  | 'recipeDetail'
  | 'menusIndex'
  | 'menuDetail'
  | 'cookwareIndex'
  | 'cookwareDetail'
  | 'ingredientsIndex'
  | 'groceryList';

interface PageDataRoute {
  route: string;
  query: PageQueryName;
  variables: Record<string, string>;
}

const QUERIES = pageData.queries as Record<PageQueryName, string>;
const ROUTES = pageData.routes as unknown as PageDataRoute[];

/** The GraphQL document a page runs, client-side and server-side alike. */
export function pageQuery(name: PageQueryName): string {
  return QUERIES[name];
}

/**
 * Query + variables for a Rex route pattern, with `":param"` variable values
 * filled from the route params. Returns null for routes not in the table.
 */
export function pageDataRequest(
  route: string,
  params: Record<string, string | string[] | undefined> = {},
): { query: string; variables: Record<string, string> } | null {
  const row = ROUTES.find((r) => r.route === route);
  if (!row) return null;
  const variables: Record<string, string> = {};
  for (const [name, value] of Object.entries(row.variables)) {
    if (value.startsWith(':')) {
      const param = params[value.slice(1)];
      variables[name] = Array.isArray(param) ? param.join('/') : (param ?? '');
    } else {
      variables[name] = value;
    }
  }
  return { query: QUERIES[row.query], variables };
}

/** Every route the table seeds. Used by the consistency test. */
export function pageDataRoutes(): readonly string[] {
  return ROUTES.map((r) => r.route);
}
