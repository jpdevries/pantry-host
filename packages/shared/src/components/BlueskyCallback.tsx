/**
 * OAuth callback page body — both packages route their
 * `/oauth/bluesky/callback` URL here.
 *
 * How it works: `BrowserOAuthClient.init()` (called in
 * `BlueskyAuthProvider` on every mount) automatically processes
 * OAuth callback parameters from the URL. So this page doesn't
 * do any auth work itself — it just waits for `isReady` and then
 * navigates back to wherever the user started the sign-in flow
 * (stored in sessionStorage under `bsky-return-to`).
 *
 * Navigation is handled via a caller-supplied `redirect` function
 * because web uses React Router and app uses plain `<a>`
 * navigation / `window.location` — we don't want to couple this
 * to either.
 */

import { useEffect } from 'react';
import { useBlueskyAuth } from '../contexts/BlueskyAuth';

export interface BlueskyCallbackProps {
  /** Called with the path to return to once auth resolves. */
  redirect: (returnTo: string) => void;
}

export function BlueskyCallback({ redirect }: BlueskyCallbackProps) {
  const { isReady, isSignedIn, handle, error } = useBlueskyAuth();

  useEffect(() => {
    if (!isReady) return;
    let returnTo = '/';
    try {
      const stored = sessionStorage.getItem('bsky-return-to');
      if (stored) {
        sessionStorage.removeItem('bsky-return-to');
        returnTo = stored;
      }
    } catch {
      /* ignore */
    }
    redirect(returnTo);
  }, [isReady, redirect]);

  return (
    <section
      id="stage"
      className="max-w-md mx-auto px-4 py-16 sm:py-24 text-center"
      aria-live="polite"
    >
      {!isReady && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Completing Bluesky sign-in&hellip;
        </p>
      )}
      {isReady && isSignedIn && handle && (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Signed in as <strong>@{handle}</strong>. Returning you to the page&hellip;
        </p>
      )}
      {isReady && !isSignedIn && (
        <>
          <p className="text-sm text-[var(--color-text-secondary)] mb-2">
            Sign-in did not complete.
          </p>
          {error && <p className="text-xs text-[var(--color-danger)] pretty">{error}</p>}
        </>
      )}
    </section>
  );
}
