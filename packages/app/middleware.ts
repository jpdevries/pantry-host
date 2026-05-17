/**
 * Shorten `/kitchens/home/X` → `/X` at the edge.
 *
 * Internal components always build canonical `/kitchens/${kitchen}/…`
 * links (no home-is-special branching). This middleware keeps the
 * URL-bar experience friendly for the home kitchen by 308-redirecting
 * the long form to the short alias. Named kitchens (`/kitchens/bar/…`)
 * pass through unchanged.
 *
 * The shape of the return value is what Rex 0.20.0's built-in
 * middleware serializer reads (`_action`, `_url`, `_status` — see
 * `globalThis.__rex_serialize_mw` in the rex binary). We'd normally
 * import `NextResponse` from `@limlabs/rex/middleware`, but that
 * package export resolves to a runtime file that doesn't ship, so
 * we construct the POJO directly.
 */

interface RexRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  cookies: Record<string, string>;
}

interface MiddlewareAction {
  _action: 'next' | 'redirect' | 'rewrite';
  _url?: string;
  _status?: number;
}

/** 308 is the method-preserving permanent redirect — browsers cache
 *  aggressively and search engines treat it as canonical, which is
 *  exactly what this kitchen-home → root alias wants. */
function redirect(url: string, status = 308): MiddlewareAction {
  return { _action: 'redirect', _url: url, _status: status };
}

function next(): MiddlewareAction {
  return { _action: 'next' };
}

export function middleware(request: RexRequest): MiddlewareAction {
  // Rex 0.20.0 passes `request.url` as the pathname only (query
  // string stripped) and runs middleware on every route (the
  // `config.matcher` is declarative and not enforced at the runtime
  // level — verified empirically). We early-return `next()` for any
  // path that doesn't need rewriting so the hot path stays cheap.
  //
  // Caveat: because Rex doesn't expose the query, a redirect from
  // `/kitchens/home/recipes?favorites=1` loses `?favorites=1`. In
  // practice only a handful of in-app links append a query (e.g.
  // `?favorites=1`, `?search=fall`), and those users can re-click on
  // the short URL after landing. Accepting that loss rather than
  // special-casing links to avoid this middleware.
  const pathname = request.url;

  // Bare `/kitchens/home` (with or without trailing slash) → `/`.
  if (pathname === '/kitchens/home' || pathname === '/kitchens/home/') {
    return redirect('/');
  }

  // `/kitchens/home/foo/bar` → `/foo/bar`. Strip the prefix verbatim so
  // nested paths (including `/kitchens/home/at/did:plc:.../…`) all land
  // on their matching top-level alias.
  if (pathname.startsWith('/kitchens/home/')) {
    return redirect(pathname.slice('/kitchens/home'.length));
  }

  return next();
}

export const config = {
  matcher: ['/kitchens/home', '/kitchens/home/:path*'],
};
