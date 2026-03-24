/**
 * Lightweight client-side GraphQL fetch helper.
 */
import { setApiOnline } from './apiStatus';

function getGraphqlUrl(): string {
  if (typeof window === 'undefined') return 'http://localhost:4001/graphql';
  const proto = window.location.protocol === 'https:' ? 'https' : 'http';
  const gqlPort = proto === 'https' ? 4443 : 4001;
  return `${proto}://${window.location.hostname}:${gqlPort}/graphql`;
}

/** Timeout in ms for GraphQL fetches. The server is on localhost/LAN so it
 * responds in <100ms when reachable. 4s is generous for cold starts but fast
 * enough to avoid hanging on mobile networks when the home server is
 * unreachable (TCP timeouts on 5G can exceed 60s). */
const GQL_TIMEOUT = 4000;
const GQL_TIMEOUT_LONG = 60000;

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  const isMutation = query.trimStart().startsWith('mutation');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), isMutation ? GQL_TIMEOUT_LONG : GQL_TIMEOUT);
  try {
    res = await fetch(getGraphqlUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: controller.signal,
    });
  } catch (err) {
    // Network failure or timeout — API is unreachable (e.g. phone at grocery store, Mac Mini at home)
    setApiOnline(false);
    throw err;
  } finally {
    clearTimeout(timer);
  }

  // Fetch succeeded — API is reachable regardless of GraphQL errors
  setApiOnline(true);

  const json = await res.json() as { data?: T; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }

  return json.data as T;
}
