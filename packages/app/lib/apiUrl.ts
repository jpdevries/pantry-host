/**
 * Resolve a URL for the backend API server (graphql-server.ts, port 4001).
 *
 * Deployment modes this supports (in precedence order):
 *
 *   1. Explicit `PUBLIC_API_ORIGIN` — set on the server, rendered into the
 *      page as `<meta name="api-origin" content="https://…">`. When
 *      present, paths resolve against it. Use this for any topology where
 *      the API isn't at the same hostname and standard-port as the
 *      frontend (e.g. Tailscale-serve setups where port 443 forwards
 *      to Rex and GraphQL lives on `:4443`, or a CDN fronting the
 *      frontend while the API lives on a sibling domain).
 *
 *   2. Empty `window.location.port` (standard 80/443, no explicit port)
 *      assumes a **path-forwarding reverse proxy** (nginx, Caddy,
 *      podman) that mounts the API at the same origin — e.g. `/graphql`
 *      is forwarded to the GraphQL container. Returns a relative URL.
 *
 *   3. Otherwise: dev mode. Frontend on :3000/:3443, API on :4001/:4443.
 *      Return the matching dedicated API port on the same hostname.
 *
 * Server-side rendering always hits `localhost:4001` — SSR runs
 * in-process on the Rex host, so going through a public URL would
 * add an unnecessary hop and wouldn't benefit from the same-origin
 * guarantees either way.
 */
export function apiUrl(path: string): string {
  if (typeof window === 'undefined') return `http://localhost:4001${path}`;

  // 1. Explicit override — authoritative when set. Resolves `path`
  //    against the origin URL, so e.g. `apiUrl('/graphql')` with an
  //    origin of `https://jmini.ts.net:4443` yields
  //    `https://jmini.ts.net:4443/graphql`.
  if (typeof document !== 'undefined') {
    const override = document
      .querySelector<HTMLMetaElement>('meta[name="api-origin"]')
      ?.content?.trim();
    if (override) {
      try {
        return new URL(path, override).toString();
      } catch {
        // Malformed URL — fall through to heuristic rather than crash
      }
    }
  }

  // 2. No port → reverse-proxy topology → same-origin relative URL.
  if (!window.location.port) return path;

  // 3. Dev: explicit port on the frontend → dedicated API port.
  const proto = window.location.protocol === 'https:' ? 'https' : 'http';
  const port = proto === 'https' ? 4443 : 4001;
  return `${proto}://${window.location.hostname}:${port}${path}`;
}
