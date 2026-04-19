/**
 * Resolve a URL for the backend API server (graphql-server.ts, port 4001).
 *
 * Deployment modes this supports:
 *   - Dev (`rex dev`):       frontend on :3000,  API on :4001
 *   - Dev (local-ssl-proxy): frontend on :3443,  API on :4443
 *   - Reverse proxy deploy:  frontend + API on :80/:443, API mounted at path
 *
 * The frontend detects the mode from window.location.port — an empty port
 * means standard 80/443, which is the reverse-proxy case, so the API is
 * assumed to be reachable at the same origin (proxy forwards /graphql and
 * /fetch-recipe to the backend). Otherwise we fall back to the dedicated
 * backend port (4001 http, 4443 https) matching the dev scripts.
 *
 * Server-side rendering always hits localhost:4001.
 */
export function apiUrl(path: string): string {
  if (typeof window === 'undefined') return `http://localhost:4001${path}`;
  if (!window.location.port) return path;
  const proto = window.location.protocol === 'https:' ? 'https' : 'http';
  const port = proto === 'https' ? 4443 : 4001;
  return `${proto}://${window.location.hostname}:${port}${path}`;
}
