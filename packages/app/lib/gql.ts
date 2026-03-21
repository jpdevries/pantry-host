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

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  let res: Response;
  try {
    res = await fetch(getGraphqlUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
  } catch (err) {
    // Network failure — API is unreachable (e.g. phone at grocery store, Mac Mini at home)
    setApiOnline(false);
    throw err;
  }

  // Fetch succeeded — API is reachable regardless of GraphQL errors
  setApiOnline(true);

  const json = await res.json() as { data?: T; errors?: { message: string }[] };

  if (json.errors?.length) {
    throw new Error(json.errors.map((e) => e.message).join('; '));
  }

  return json.data as T;
}
