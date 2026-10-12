import { pageDataRequest } from '@pantry-host/shared/page-data';

/** Props every server-seeded page receives. */
export interface PageDataProps<T> {
  /** The GraphQL `data` object for the route's query. */
  initialData?: T;
  /** Active kitchen slug, read by `_app`'s KitchenProvider during SSR. */
  kitchen?: string;
}

// Shared getServerSideProps body for every route in
// @pantry-host/shared/page-data. Each page calls it with its own Rex route
// pattern:
//
//   export async function getServerSideProps(ctx: PageDataContext) {
//     return getPageData('/menus', ctx);
//   }
//
// Transport rules (same as before this helper existed): go through the
// standalone GraphQL server over HTTP, which requires the Rex process to run
// with REX_INTERNAL_ORIGIN=http://127.0.0.1:4001 (Rex's V8 fetch blocks
// loopback otherwise), and never block the render for more than 5s. On any
// failure return no props; the page falls back to its client-side fetch.
//
// The Rust server fills the same `initialData` for its embedded SPA shell
// (packages/server/src/frontend.rs), so pages can't tell which backend
// rendered them.
export interface PageDataContext {
  params?: Record<string, string | string[] | undefined>;
}

export async function getPageData<T>(route: string, ctx: PageDataContext = {}): Promise<{ props: PageDataProps<T> }> {
  // Always pass the kitchen, even when the data fetch fails: Rex's SSR router
  // can't resolve it from the URL (see lib/kitchen-context.tsx).
  const param = ctx.params?.kitchen;
  const kitchen = typeof param === 'string' && param ? param : 'home';
  const request = pageDataRequest(route, ctx.params);
  if (!request) {
    console.error('[pageData] no page-data row for route %s', route);
    return { props: { kitchen } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('http://127.0.0.1:4001/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
      signal: controller.signal,
    });
    if (!res.ok) {
      const snippet = (await res.text()).slice(0, 200);
      console.error('[pageData] %s non-OK response status=%d body=%s', route, res.status, snippet);
      return { props: { kitchen } };
    }
    const body = (await res.json()) as { data?: T | null; errors?: unknown };
    if (body.errors || !body.data) {
      console.error('[pageData] %s GraphQL errors vars=%s: %s', route, JSON.stringify(request.variables), JSON.stringify(body.errors));
      return { props: { kitchen } };
    }
    return { props: { initialData: body.data, kitchen } };
  } catch (e) {
    console.error('[pageData] %s fetch failed: %s', route, e instanceof Error ? (e.stack ?? e.message) : String(e));
    return { props: { kitchen } };
  } finally {
    clearTimeout(timer);
  }
}
