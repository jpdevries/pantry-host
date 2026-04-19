/**
 * Bluesky auth context — wraps `@atproto/oauth-client-browser` and
 * exposes a stable `{ isReady, isSignedIn, handle, did, agent,
 * signIn, signOut }` shape to the rest of the tree.
 *
 * Shared between the web PWA (Vite / React Router) and the
 * self-hosted app (Rex / SSR). Rex renders this on the server, so
 * every browser-only side effect is gated behind `useEffect`:
 *   - `BrowserOAuthClient` is imported via `await import(...)` on
 *     mount — the library crashes if loaded in a Node context.
 *   - `client.init()` is called once per mount.
 *   - SSR always sees `{ isReady: false, isSignedIn: false }` so
 *     the "Sign in to publish" placeholder renders identically on
 *     both passes and hydration is quiet.
 *
 * Client identity:
 *   - **Prod**: `https://pantryhost.app/client-metadata.json` is
 *     fetched via `BrowserOAuthClient.load({ clientId })`.
 *   - **Dev (localhost)**: the loopback form — `new
 *     BrowserOAuthClient({ clientMetadata: undefined })`. Requires
 *     the dev server to be reached via `http://127.0.0.1` (not
 *     `localhost`) — per atproto OAuth spec loopback rules.
 *
 * Auth path decision recorded in
 * `memory/project_bluesky_app_status.md` and
 * `packages/marketing/ATPROTO-TIER-1.5.md` — OAuth from day one,
 * no app passwords.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

// ── Types ────────────────────────────────────────────────────────────────

export interface BlueskyAuthState {
  /** False until the provider has finished its first init() call
   *  (i.e. we've either restored a session, processed an OAuth
   *  callback, or confirmed there was nothing to restore). */
  isReady: boolean;
  isSignedIn: boolean;
  did: string | null;
  handle: string | null;
  /** Raw `@atproto/api` Agent, ready to make authenticated calls.
   *  Null until the user is signed in. Typed as unknown here so
   *  the shared package doesn't hard-require `@atproto/api` at
   *  its call sites — the `atproto-publish` client does its own
   *  duck-typing via `PublishAgent`. */
  agent: unknown | null;
  /** Kick off the OAuth redirect. Never resolves in the happy
   *  path — the browser navigates away. Throws if not ready. */
  signIn: (handleInput: string) => Promise<void>;
  /** Revoke tokens and drop local session state. */
  signOut: () => Promise<void>;
  /** Human-readable status for error toasts / debug. */
  error: string | null;
}

const DEFAULT_STATE: BlueskyAuthState = {
  isReady: false,
  isSignedIn: false,
  did: null,
  handle: null,
  agent: null,
  signIn: async () => {
    throw new Error('BlueskyAuthProvider not mounted');
  },
  signOut: async () => {
    throw new Error('BlueskyAuthProvider not mounted');
  },
  error: null,
};

const BlueskyAuthContext = createContext<BlueskyAuthState>(DEFAULT_STATE);

// ── Client construction ──────────────────────────────────────────────────

/** Read the prod client-metadata URL — override-able via env for
 *  staging. Defaults to pantryhost.app. */
function getProdClientId(): string {
  try {
    // @ts-expect-error Vite-ism
    const fromVite = import.meta?.env?.VITE_ATPROTO_CLIENT_ID;
    if (fromVite) return String(fromVite);
  } catch {
    /* not vite */
  }
  if (typeof process !== 'undefined' && process.env?.ATPROTO_CLIENT_ID) {
    return process.env.ATPROTO_CLIENT_ID;
  }
  return 'https://pantryhost.app/client-metadata.json';
}

/** Loopback-safe or hosted-metadata-safe? We key off origin. The
 *  atproto OAuth spec requires the loopback path to use
 *  `127.0.0.1` / `[::1]` — `localhost` won't be accepted by the
 *  PDS authorization server. */
function isLoopbackOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname } = window.location;
  return hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1';
}

function isLocalhostOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname === 'localhost';
}

// ── Provider ─────────────────────────────────────────────────────────────

export interface BlueskyAuthProviderProps {
  children: ReactNode;
  /** Where the OAuth callback lives. Both packages put it at
   *  `/oauth/bluesky/callback`. Passed in so each package can
   *  mount it on its own router. */
  callbackPath?: string;
}

export function BlueskyAuthProvider({
  children,
  callbackPath = '/oauth/bluesky/callback',
}: BlueskyAuthProviderProps) {
  const [isReady, setIsReady] = useState(false);
  const [session, setSession] = useState<unknown | null>(null);
  const [did, setDid] = useState<string | null>(null);
  const [handle, setHandle] = useState<string | null>(null);
  const [agent, setAgent] = useState<unknown | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Hold the BrowserOAuthClient across renders. Stored in state
  // rather than a ref so we can await it in signIn/signOut via
  // closure — and so hot-reload gets a fresh one.
  const [client, setClient] = useState<any>(null);

  // One-shot init on mount. SSR sees isReady=false and renders
  // "Sign in" placeholders.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;

    (async () => {
      try {
        const { BrowserOAuthClient } = await import('@atproto/oauth-client-browser');
        const { Agent } = await import('@atproto/api');
        const url = new URL(window.location.href);
        const callbackAbsolute = `${url.origin}${callbackPath}`;

        let c: any;
        if (isLoopbackOrigin()) {
          // Loopback client — no hosted metadata. The library's
          // default `buildLoopbackClientId(window.location)` bakes
          // the current pathname into the client_id, which then
          // fails validation ("must not contain a path component")
          // when init() is triggered from any deep route. Work
          // around by constructing the loopback client_id from a
          // path-free location and providing the metadata up front.
          // Callback lands on `/` — the provider's init() handler
          // picks up OAuth params regardless of route.
          const { buildLoopbackClientId } = await import('@atproto/oauth-client-browser');
          const { atprotoLoopbackClientMetadata } = await import('@atproto/oauth-types');
          const loc = {
            hostname: window.location.hostname,
            port: window.location.port,
            pathname: '/',
          } as Location;
          const clientId = buildLoopbackClientId(loc);
          const clientMetadata = (atprotoLoopbackClientMetadata as (cid: string) => unknown)(clientId);
          c = new BrowserOAuthClient({
            clientMetadata,
            handleResolver: 'https://bsky.social',
            allowHttp: true,
          } as any);
        } else if (isLocalhostOrigin()) {
          // `localhost` won't work with loopback-client OAuth. Warn
          // loudly rather than silently failing at signIn time.
          console.warn(
            '[BlueskyAuth] The atproto OAuth loopback client requires http://127.0.0.1 (or [::1]) — localhost will not be accepted. Reach this app via http://127.0.0.1:' +
              window.location.port +
              ' to sign in with Bluesky.',
          );
          setError(
            'Bluesky sign-in requires http://127.0.0.1 in dev. Open this app at 127.0.0.1 instead of localhost.',
          );
          setIsReady(true);
          return;
        } else {
          // Hosted client — fetch the metadata file.
          c = await BrowserOAuthClient.load({
            clientId: getProdClientId(),
            handleResolver: 'https://bsky.social',
          } as any);
        }
        if (cancelled) return;
        setClient(c);

        const result = await c.init();
        if (cancelled) return;

        if (result?.session) {
          const s = result.session;
          setSession(s);
          setDid(s.did);
          // Resolve the handle for display. Best-effort — the session
          // may not carry it, so fall back to the DID.
          try {
            const a = new Agent(s as any);
            setAgent(a);
            // Most PDSes expose the handle on the DID doc via
            // com.atproto.identity.resolveHandle inverse lookups;
            // easiest quick-path is a profile read.
            const profile = await a.com.atproto.repo.describeRepo({ repo: s.did });
            const resolved =
              (profile?.data as any)?.handle || s.did;
            if (!cancelled) setHandle(resolved);
          } catch {
            if (!cancelled) setHandle(s.did);
            if (!cancelled) setAgent(new Agent(s as any));
          }
        }
        if (!cancelled) setIsReady(true);
      } catch (err: any) {
        if (!cancelled) {
          console.error('[BlueskyAuth] init failed', err);
          setError(err?.message ?? 'Failed to initialize Bluesky auth');
          setIsReady(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // callbackPath is effectively a constant per mount — intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [callbackPath]);

  const signIn = useCallback(
    async (handleInput: string) => {
      if (!client) throw new Error('Bluesky auth not ready');
      const clean = handleInput.trim().replace(/^@/, '');
      if (!clean) throw new Error('Enter a Bluesky handle');
      // Stash where we came from so the callback can send us back.
      try {
        sessionStorage.setItem('bsky-return-to', window.location.pathname + window.location.search + window.location.hash);
      } catch {
        /* ignore */
      }
      // signInRedirect never resolves in the happy path — the
      // browser navigates away. Let the caller's promise stay
      // pending so any loading UI stays on.
      // Only `atproto` scope is needed for com.atproto.repo.* writes.
      // `transition:generic` would be required to touch app.bsky.*
      // endpoints (posts, feeds, profiles) — we don't.
      await client.signInRedirect(clean, {
        scope: 'atproto',
      });
    },
    [client],
  );

  const signOut = useCallback(async () => {
    if (!client || !did) return;
    try {
      await client.revoke(did);
    } catch {
      // best-effort — even if revoke fails locally we still drop state
    }
    setSession(null);
    setDid(null);
    setHandle(null);
    setAgent(null);
  }, [client, did]);

  const value = useMemo<BlueskyAuthState>(
    () => ({
      isReady,
      isSignedIn: Boolean(session),
      did,
      handle,
      agent,
      signIn,
      signOut,
      error,
    }),
    [isReady, session, did, handle, agent, signIn, signOut, error],
  );

  return <BlueskyAuthContext.Provider value={value}>{children}</BlueskyAuthContext.Provider>;
}

/** Consumer hook. Safe to call from SSR — returns the default
 *  (not-signed-in, not-ready) state if no provider is mounted,
 *  which matches the "in dev I'm not wrapping the tree yet"
 *  degraded experience without throwing. */
export function useBlueskyAuth(): BlueskyAuthState {
  return useContext(BlueskyAuthContext);
}
