/**
 * Sign-in modal — prompts the user for their Bluesky handle and
 * kicks off the OAuth redirect via the BlueskyAuth context.
 *
 * This is the only place we collect the handle; once sign-in
 * succeeds the context's `signIn` has already navigated the
 * browser to the PDS authorization server and then back to our
 * callback route, so this modal never re-renders after submit.
 *
 * Note: atproto OAuth never asks the user for a password here —
 * the handle is only used for handle-to-PDS resolution. Real
 * authentication happens on the PDS's own login screen.
 */

import { useState } from 'react';
import Modal from './Modal';
import { useBlueskyAuth } from '../contexts/BlueskyAuth';

export interface BlueskySignInModalProps {
  open: boolean;
  onClose: () => void;
}

export default function BlueskySignInModal({ open, onClose }: BlueskySignInModalProps) {
  const { signIn, isReady, error: ctxError } = useBlueskyAuth();
  const [handle, setHandle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLocalError(null);
    setSubmitting(true);
    try {
      await signIn(handle);
      // signIn navigates away; this line rarely runs.
    } catch (err: any) {
      setLocalError(err?.message ?? 'Sign-in failed');
      setSubmitting(false);
    }
  }

  const err = localError ?? ctxError;

  return (
    <Modal open={open} onClose={onClose} title="Sign in with Bluesky">
      <div className="p-5 space-y-4">
        <header>
          <h2 className="text-lg font-bold mb-1">Sign in with Bluesky</h2>
          <p className="text-xs text-[var(--color-text-secondary)] pretty">
            Pantry&nbsp;Host publishes recipes to your PDS via AT Protocol OAuth.
            Your password is only entered on your PDS&apos;s login screen — never here.
          </p>
        </header>

        <form onSubmit={onSubmit} className="space-y-3">
          <div>
            <label htmlFor="bsky-handle" className="block text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
              Handle
            </label>
            <input
              id="bsky-handle"
              type="text"
              autoComplete="username"
              autoFocus
              placeholder="jpdevries.bsky.social"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              disabled={submitting || !isReady}
              className="w-full px-3 py-2 text-sm rounded-md border border-[var(--color-border-card)] bg-[var(--color-bg-body)] font-mono"
            />
          </div>

          {err && <p className="text-xs text-[var(--color-danger)] pretty">{err}</p>}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-border-card)] hover:underline"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !handle.trim() || !isReady}
              className="px-3 py-1.5 text-sm rounded-md bg-[var(--color-accent)] text-[var(--color-bg-body)] font-semibold disabled:bg-[var(--color-bg-card)] disabled:text-[var(--color-text-secondary)] disabled:border disabled:border-[var(--color-border-card)]"
            >
              {submitting ? 'Redirecting…' : !isReady ? 'Loading…' : 'Continue'}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
