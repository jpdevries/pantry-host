/**
 * Small status + sign-out block for `/settings` — shows whether the
 * user is signed in via AT Protocol OAuth and offers a one-click
 * sign-out. Pulled into the shared SettingsPage so both the web PWA
 * and the self-hosted app surface it without duplication.
 *
 * Renders nothing until the provider is ready (avoids hydration flash
 * on Rex SSR, where the client-only context always starts in the
 * not-ready state).
 */

import { useState } from 'react';
import { Butterfly } from '@phosphor-icons/react';
import { useBlueskyAuth } from '../contexts/BlueskyAuth';

export default function BlueskyAccountStatus() {
  const { isReady, isSignedIn, handle, did, signOut, error } = useBlueskyAuth();
  const [working, setWorking] = useState(false);

  if (!isReady) return null;

  async function handleSignOut() {
    setWorking(true);
    try {
      await signOut();
    } finally {
      setWorking(false);
    }
  }

  return (
    <fieldset className="card p-5 space-y-4 border border-[var(--color-border-card)]">
      <legend className="px-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
        Bluesky account
      </legend>
      <div className="flex items-start gap-3">
        <Butterfly size={24} weight="light" aria-hidden className="opacity-60 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          {isSignedIn ? (
            <>
              <p className="text-sm">
                Signed in as <strong>@{handle ?? did}</strong>.
              </p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 pretty">
                Pantry&nbsp;Host can publish recipes and menus to your PDS on your behalf.
                Sign-out revokes the session on your PDS and clears the tokens from this browser.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm">Not signed in to Bluesky.</p>
              <p className="text-xs text-[var(--color-text-secondary)] mt-1 pretty">
                Click <em>Share to Bluesky</em> on any recipe or menu to sign in and
                publish to your PDS.
              </p>
            </>
          )}
          {error && (
            <p className="text-xs text-[var(--color-danger)] mt-2 pretty">{error}</p>
          )}
        </div>
        {isSignedIn && (
          <button
            type="button"
            onClick={handleSignOut}
            disabled={working}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-border-card)] hover:underline disabled:opacity-50 shrink-0"
          >
            {working ? 'Signing out\u2026' : 'Sign out'}
          </button>
        )}
      </div>
    </fieldset>
  );
}
