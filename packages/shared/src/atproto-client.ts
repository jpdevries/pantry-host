/**
 * AT Protocol OAuth client identity — the non-React pieces shared by the
 * auth client (packages/shared/src/contexts/BlueskyAuth.tsx) and the
 * self-hoster's client-metadata generator (packages/app/scripts/gen-client-metadata.ts).
 *
 * A Pantry Host instance authenticates to a user's PDS as an OAuth client
 * identified by a public HTTPS `client-metadata.json`. The hosted apps use
 * pantryhost.app's document; a self-hoster who wants OAuth *sovereignty*
 * (no dependency on the pantryhost.app publish broker) hosts their own,
 * with their instance's callback in `redirect_uris`, and points the app at
 * it via `ATPROTO_CLIENT_ID` / `VITE_ATPROTO_CLIENT_ID`. See
 * docs/self-hosted-oauth.md.
 *
 * Kept React-free so the generator script can import it without pulling a
 * context module (and its React dependency) into a Node CLI.
 */

/** The hosted client identity — pantryhost.app's published metadata.
 *  Default when no `ATPROTO_CLIENT_ID` override is configured. */
export const DEFAULT_CLIENT_METADATA_URL =
  'https://pantryhost.app/client-metadata.json';

/** Everything Share-to-Bluesky needs, as granular atproto OAuth scopes:
 *  full CRUD on both exchange.recipe.* collections (publish, re-publish via
 *  putRecord, unpublish via deleteRecord) plus image blob upload for recipe
 *  photos. The bare `atproto` scope only grants identity — PDSes enforce
 *  per-collection `repo:` scopes on record writes. This is the single source
 *  of truth: BlueskyAuth bakes it into sign-in requests and the loopback
 *  client_id, and buildClientMetadata() writes it into hosted metadata, so a
 *  self-hoster's document can never drift from what the client requests. */
export const ATPROTO_PUBLISH_OAUTH_SCOPE =
  'atproto repo:exchange.recipe.recipe repo:exchange.recipe.collection blob:image/*';

/** The callback route both packages mount for the OAuth redirect. */
export const OAUTH_CALLBACK_PATH = '/oauth/bluesky/callback';

export interface ClientMetadata {
  client_id: string;
  client_name: string;
  client_uri: string;
  logo_uri: string;
  tos_uri: string;
  policy_uri: string;
  redirect_uris: string[];
  grant_types: string[];
  response_types: string[];
  scope: string;
  token_endpoint_auth_method: string;
  application_type: string;
  dpop_bound_access_tokens: boolean;
}

/**
 * Build a `client-metadata.json` document for a self-hosted instance served
 * over public HTTPS at `baseUrl` (e.g. `https://recipes.example.com`). The
 * `client_id` is the document's own public URL — the AT authorization server
 * fetches it to learn the client, so it must resolve to exactly this JSON.
 *
 * @param baseUrl  Public HTTPS origin (no trailing slash needed) where the
 *                 instance — and this metadata document — are reachable.
 * @param clientName Optional display name shown on the PDS consent screen.
 */
export function buildClientMetadata(
  baseUrl: string,
  clientName = 'Pantry Host (self-hosted)',
): ClientMetadata {
  const base = baseUrl.replace(/\/+$/, '');
  if (!/^https:\/\//i.test(base)) {
    throw new Error(
      `client-metadata base URL must be public HTTPS, got: ${baseUrl}`,
    );
  }
  return {
    client_id: `${base}/client-metadata.json`,
    client_name: clientName,
    client_uri: base,
    logo_uri: `${base}/icon-512.png`,
    tos_uri: base,
    policy_uri: base,
    redirect_uris: [`${base}${OAUTH_CALLBACK_PATH}`],
    grant_types: ['authorization_code', 'refresh_token'],
    response_types: ['code'],
    scope: ATPROTO_PUBLISH_OAUTH_SCOPE,
    token_endpoint_auth_method: 'none',
    application_type: 'web',
    dpop_bound_access_tokens: true,
  };
}
