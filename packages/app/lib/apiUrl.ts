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
 *      It can also be a comma-separated list whose entries are scoped to
 *      the page hostname they apply to, `host=origin` (see
 *      `pickApiOrigin`). Scope it when the same Rex is also reached
 *      directly: `jmini.tailb4b427.ts.net=https://jmini.tailb4b427.ts.net:4443`
 *      applies on the tailnet name only, so a LAN device on
 *      `http://192.168.x.x:3000` (which can't resolve or reach the
 *      tailnet URL — the Kindle) falls through to rule 3.
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
import { isBrowser, isServer } from '@pantry-host/shared/env';

/**
 * The API origin `PUBLIC_API_ORIGIN` gives a page on `hostname`: the first
 * `host=origin` entry scoped to that hostname, else the first unscoped
 * entry, else null (fall through to the heuristics). A single unscoped
 * origin, the original form, applies everywhere.
 */
export function pickApiOrigin(value: string, hostname: string): string | null {
  let unscoped: string | null = null;
  for (const raw of value.split(',')) {
    const entry = raw.trim();
    const eq = entry.indexOf('=');
    // Origins carry no '=', and a scope is a bare hostname (no '/').
    if (eq > 0 && !entry.slice(0, eq).includes('/')) {
      if (entry.slice(0, eq).trim().toLowerCase() === hostname.toLowerCase()) return entry.slice(eq + 1).trim();
    } else if (entry && unscoped === null) {
      unscoped = entry;
    }
  }
  return unscoped;
}

export function apiUrl(path: string): string {
  if (isServer) return `http://localhost:4001${path}`;

  // 1. Explicit override — authoritative when set. Resolves `path`
  //    against the origin URL, so e.g. `apiUrl('/graphql')` with an
  //    origin of `https://jmini.ts.net:4443` yields
  //    `https://jmini.ts.net:4443/graphql`.
  if (isBrowser) {
    const meta = document
      .querySelector<HTMLMetaElement>('meta[name="api-origin"]')
      ?.content?.trim();
    const override = meta ? pickApiOrigin(meta, window.location.hostname) : null;
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
