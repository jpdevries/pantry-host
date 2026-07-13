/**
 * Publish broker — lets a self-hosted Pantry Host instance publish to
 * Bluesky through a popup on the hosted Tier 1 origin
 * (my.pantryhost.app), where AT Protocol OAuth actually works.
 *
 * Why: AT OAuth requires the client_id to be a publicly-fetchable
 * HTTPS document and web-client redirect URIs to live on that origin.
 * A LAN / Tailscale / plain-HTTP self-hosted box can't satisfy either,
 * so it can never complete the OAuth dance itself (see issue #37).
 * The broker popup runs on the public origin, holds the OAuth session
 * there, and performs the browser → PDS write on the requester's
 * behalf. The flow is:
 *
 *   self-hosted page ──window.open──▶ my.pantryhost.app/publish-broker
 *        │                                   │
 *        │◀───────── ph-broker:ready ────────│
 *        │────────── ph-broker:request ─────▶│  (payload; Blobs structured-clone)
 *        │                                   │  user reviews + CONFIRMS in popup
 *        │                                   │──▶ PDS (putRecord, browser-side)
 *        │◀───────── ph-broker:result ───────│  (receipts, targetOrigin-locked)
 *
 * Security invariants (keep these when editing):
 * - Tokens/DPoP keys NEVER leave the broker origin. Only record
 *   payloads go in; only receipts come out.
 * - The broker accepts exactly ONE request per popup lifetime — no
 *   payload swapping after the confirm UI renders.
 * - The confirm click happens INSIDE the popup (real URL bar, no
 *   clickjacking), with the requesting origin displayed prominently.
 * - Replies use an explicit targetOrigin (the captured requester
 *   origin), never '*'. The ready ping carries no data, so '*' is
 *   acceptable there (the popup can't know its opener's origin first).
 * - No auto-publish: nothing is written without a user gesture in the
 *   trusted origin.
 *
 * The record still travels browser → PDS; Pantry Host infrastructure
 * stores nothing. The trade-off is availability/trust coupling to the
 * hosted origin — the fully-sovereign alternatives (own public domain,
 * app passwords) are tracked in #37.
 */

import { fetchPhotoBlob, type PublishableMenu, type PublishableRecipe } from './atproto-publish';

// ── Protocol ─────────────────────────────────────────────────────────────

export const BROKER_READY = 'ph-broker:ready';
export const BROKER_REQUEST = 'ph-broker:request';
export const BROKER_RESULT = 'ph-broker:result';

export interface BrokerReceipt {
  uri: string;
  cid: string;
  handle: string;
  dryRun: boolean;
}

export type BrokerRequest =
  | {
      type: typeof BROKER_REQUEST;
      action: 'publish';
      kind: 'recipe';
      recipe: PublishableRecipe;
      /** Re-publish target for records that predate deterministic
       *  rkeys — omit to publish at rkeyForLocal(recipe.id). */
      rkey?: string;
      /** The recipe's at:// sourceUrl, when it has one. The requester
       *  can't know whose record it is (it has no session); the BROKER
       *  decides after sign-in: if the signed-in DID owns it, publish
       *  at its rkey (adopt-own-records — updates the original instead
       *  of minting a duplicate). Ignored otherwise. */
      adoptUri?: string;
      /** photoUrl → bytes, fetched by the requester (same-origin
       *  there; the broker origin can't reach a LAN box). */
      photoBlobs?: Record<string, Blob>;
      dryRun: boolean;
    }
  | {
      type: typeof BROKER_REQUEST;
      action: 'publish';
      kind: 'menu';
      menu: PublishableMenu;
      rkey?: string;
      /** See the recipe variant — the menu's at:// sourceUrl. */
      adoptUri?: string;
      /** recipeId → known-good strongRef, so already-published
       *  children are reused instead of re-published. */
      existingRefs?: Record<string, { uri: string; cid: string }>;
      photoBlobs?: Record<string, Blob>;
      dryRun: boolean;
    }
  | {
      type: typeof BROKER_REQUEST;
      action: 'unpublish';
      kind: 'recipe' | 'menu';
      uri: string;
      /** Shown in the confirm UI so the user knows what they're deleting. */
      title: string;
      dryRun: boolean;
    };

export type BrokerResult =
  | {
      type: typeof BROKER_RESULT;
      ok: true;
      action: 'publish';
      kind: 'recipe' | 'menu';
      receipt: BrokerReceipt;
      /** Menu publishes: receipts for children published inline, so
       *  the requester can persist them for future Reuse. */
      childReceipts?: Record<string, BrokerReceipt>;
    }
  | { type: typeof BROKER_RESULT; ok: true; action: 'unpublish' }
  | { type: typeof BROKER_RESULT; ok: false; error: 'cancelled' | 'sign-in-failed' | string };

// ── Broker location ──────────────────────────────────────────────────────

export const DEFAULT_BROKER_URL = 'https://my.pantryhost.app/publish-broker';

/** Resolve the broker URL: Vite env (web dev), meta tag (Rex — same
 *  channel as atproto-publish-dry-run), then the hosted default. */
export function brokerUrl(): string {
  try {
    // Exact `import.meta.env.VITE_X` token required — Vite's env
    // replacement doesn't recognize optional-chained (`?.`) access,
    // so that "defensive" spelling silently reads undefined forever.
    // The try/catch handles non-Vite bundlers (Rex: env is undefined
    // → TypeError → caught).
    // @ts-expect-error import.meta.env is a Vite-ism
    const vite = import.meta.env.VITE_ATPROTO_BROKER_URL;
    if (vite) return String(vite);
  } catch {
    /* not vite */
  }
  if (typeof document !== 'undefined') {
    const meta = document.querySelector('meta[name="atproto-broker-url"]')?.getAttribute('content');
    if (meta) return meta;
  }
  return DEFAULT_BROKER_URL;
}

/** True when this instance is configured with its OWN atproto OAuth
 *  client — a self-hosted `client-metadata.json` whose `redirect_uris`
 *  include this instance's callback. Such an instance completes OAuth
 *  directly against its own origin and needs no pantryhost.app broker
 *  (OAuth *sovereignty*; see docs/self-hosted-oauth.md). Resolution
 *  mirrors getProdClientId(): Vite env → `atproto-client-id` meta tag
 *  (Rex) → process.env. Presence of an override is the signal — the
 *  hosted default doesn't count (its redirect_uris don't cover a
 *  self-hosted origin, which is exactly why the broker exists). */
export function hasSelfHostedOAuthClient(): boolean {
  try {
    // @ts-expect-error import.meta.env is a Vite-ism (see brokerUrl()).
    if (import.meta.env.VITE_ATPROTO_CLIENT_ID) return true;
  } catch {
    /* not vite */
  }
  if (typeof document !== 'undefined') {
    if (document.querySelector('meta[name="atproto-client-id"]')?.getAttribute('content')) {
      return true;
    }
  }
  if (typeof process !== 'undefined' && process.env?.ATPROTO_CLIENT_ID) return true;
  return false;
}

/** True when this origin cannot complete AT OAuth itself and should
 *  publish through the broker popup instead: not the spec loopback
 *  (127.0.0.1 / [::1]), not an origin the hosted client's redirect_uris
 *  cover, and not a sovereign instance running its own OAuth client.
 *  Deliberately includes `localhost` — the spec rejects it for loopback
 *  OAuth, but the broker works fine there. */
export function shouldUseBroker(): boolean {
  if (typeof window === 'undefined') return false;
  const { hostname, origin } = window.location;
  if (hostname === '127.0.0.1' || hostname === '[::1]' || hostname === '::1') return false;
  // A sovereign self-hoster (own client-metadata.json) does direct OAuth.
  if (hasSelfHostedOAuthClient()) return false;
  const brokerOrigin = new URL(brokerUrl()).origin;
  // Direct OAuth works on the hosted origins themselves (and on the
  // broker origin — a broker popup opening a broker would be silly).
  if (origin === brokerOrigin) return false;
  if (origin === 'https://my.pantryhost.app' || origin === 'https://pantryhost.app') return false;
  return true;
}

// ── Requester-side helpers ───────────────────────────────────────────────

/** Fetch each photoUrl into a Blob from the REQUESTER's context, where
 *  `/uploads/…` paths are same-origin. Pass `fetchPhoto` to override
 *  resolution for schemes plain fetch can't reach — the web PWA's
 *  `opfs://` photos need its OPFS-aware resolver here just like they
 *  do for direct publishes. Failures are skipped — a photo never
 *  blocks a publish (same policy as direct publishing). */
export async function collectPhotoBlobs(
  photoUrls: Array<string | null | undefined>,
  fetchPhoto?: (photoUrl: string) => Promise<Blob | null>,
): Promise<Record<string, Blob>> {
  const out: Record<string, Blob> = {};
  const unique = [...new Set(photoUrls.filter((u): u is string => !!u))];
  await Promise.all(
    unique.map(async (url) => {
      try {
        if (fetchPhoto) {
          const blob = await fetchPhoto(url);
          if (blob) out[url] = blob;
          return;
        }
        // Default resolver knows the PDS sync.getBlob path for
        // CORS-blocked Bluesky CDN URLs, not just plain fetch.
        const blob = await fetchPhotoBlob(url);
        if (blob) out[url] = blob;
      } catch {
        /* skip — broker will publish without this photo */
      }
    }),
  );
  return out;
}

/** How long the requester waits for the user to finish in the popup.
 *  Generous: sign-in (an OAuth round-trip) can happen mid-flow. */
const BROKER_TIMEOUT_MS = 5 * 60 * 1000;
const POPUP_FEATURES = 'width=480,height=760,noopener=no';

/**
 * Open the broker popup and run one request through it. MUST be called
 * synchronously from a user gesture (click handler) or popup blockers
 * eat the window — which is why `request` may be a Promise: the popup
 * opens immediately on the click tick, and slow prep (photo Blob
 * collection) resolves while the popup is still loading.
 *
 * The broker popup never navigates: OAuth sign-in runs in a NESTED
 * popup (BlueskyAuth's signInPopup), because the PDS auth pages send
 * COOP headers that would sever window.opener on a redirect round-trip
 * and orphan the broker from us. The requester's promise stays pending
 * across sign-in; the re-send-on-ready handling below is defensive
 * (e.g. a manual reload of the popup before the request is accepted).
 */
export function publishViaBroker(
  request: BrokerRequest | Promise<BrokerRequest>,
  url = brokerUrl(),
): Promise<BrokerResult> {
  const brokerOrigin = new URL(url).origin;
  const popup = typeof window !== 'undefined' ? window.open(url, 'ph-publish-broker', POPUP_FEATURES) : null;
  if (!popup) {
    return Promise.resolve({
      type: BROKER_RESULT,
      ok: false,
      error: 'Popup blocked — allow popups for this site and try again.',
    });
  }

  return new Promise<BrokerResult>((resolve) => {
    let settled = false;
    const settle = (result: BrokerResult) => {
      if (settled) return;
      settled = true;
      window.removeEventListener('message', onMessage);
      clearInterval(closedPoll);
      clearTimeout(deadline);
      resolve(result);
    };

    const onMessage = async (event: MessageEvent) => {
      if (event.origin !== brokerOrigin || event.source !== popup) return;
      const data = event.data as { type?: string } | null;
      if (data?.type === BROKER_READY) {
        // (Re-)send the payload — targetOrigin locked to the broker.
        try {
          popup.postMessage(await request, brokerOrigin);
        } catch (err) {
          settle({ type: BROKER_RESULT, ok: false, error: err instanceof Error ? err.message : 'Failed to prepare the publish payload.' });
          popup.close();
        }
        return;
      }
      if (data?.type === BROKER_RESULT) {
        settle(data as BrokerResult);
        popup.close();
      }
    };
    window.addEventListener('message', onMessage);

    // User closed the popup without finishing.
    const closedPoll = setInterval(() => {
      if (popup.closed) settle({ type: BROKER_RESULT, ok: false, error: 'cancelled' });
    }, 500);

    const deadline = setTimeout(() => {
      settle({ type: BROKER_RESULT, ok: false, error: 'Timed out waiting for the publish window.' });
      try {
        popup.close();
      } catch {
        /* already gone */
      }
    }, BROKER_TIMEOUT_MS);
  });
}
