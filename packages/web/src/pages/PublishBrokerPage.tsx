/**
 * /publish-broker — the trusted-origin side of the publish broker
 * (see @pantry-host/shared/atproto-broker for the protocol and the
 * security invariants).
 *
 * Opened as a POPUP by a self-hosted Pantry Host instance whose origin
 * can't complete AT OAuth (issue #37). This page runs on the hosted
 * origin where OAuth works, so the session — and its DPoP keys — never
 * leave here. The requester sends a record payload in; the user reviews
 * it HERE (real URL bar, requesting origin displayed, confirm click
 * inside this window); the write goes browser → PDS; only receipts go
 * back, targetOrigin-locked to the requester.
 *
 * One request per popup lifetime: the first ph-broker:request wins and
 * later ones are ignored, so the payload can't be swapped after the
 * confirm UI renders.
 */

import { useEffect, useRef, useState } from 'react';
import { Butterfly } from '@phosphor-icons/react';
import BlueskySignInModal from '@pantry-host/shared/components/BlueskySignInModal';
import { useBlueskyAuth } from '@pantry-host/shared/contexts/BlueskyAuth';
import {
  BROKER_READY,
  BROKER_REQUEST,
  BROKER_RESULT,
  type BrokerReceipt,
  type BrokerRequest,
  type BrokerResult,
} from '@pantry-host/shared/atproto-broker';
import {
  adoptRkeyFromSource,
  buildCollectionRecord,
  buildRecipeRecord,
  fetchPhotoBlob,
  LEXICON_COLLECTION,
  LEXICON_RECIPE,
  publishCollection,
  publishRecipe,
  unpublish,
  type PublishAgent,
} from '@pantry-host/shared/atproto-publish';

type Phase =
  | { name: 'waiting' } // no opener message yet (or opened directly)
  | { name: 'review'; request: BrokerRequest; requesterOrigin: string }
  | { name: 'publishing'; request: BrokerRequest; requesterOrigin: string }
  | { name: 'done'; message: string }
  | { name: 'error'; message: string };

export default function PublishBrokerPage() {
  const { isReady, isSignedIn, agent, handle, did } = useBlueskyAuth();
  const [phase, setPhase] = useState<Phase>({ name: 'waiting' });
  const [signInOpen, setSignInOpen] = useState(false);
  const [announcement, setAnnouncement] = useState('');
  const headingRef = useRef<HTMLHeadingElement>(null);
  // The window we reply to, captured from the accepted request event.
  const requesterRef = useRef<{ source: MessageEventSource; origin: string } | null>(null);
  const acceptedRef = useRef(false);

  useEffect(() => {
    document.title = 'Publish to Bluesky — Pantry Host';
  }, []);

  // Handshake: announce readiness to the opener, accept the FIRST
  // request, ignore everything after. NOTE: this page must never
  // navigate — the PDS auth pages send COOP headers that would sever
  // window.opener for good, orphaning us from the requester. That's
  // why sign-in below uses the popup flow, not the redirect flow.
  useEffect(() => {
    function onMessage(event: MessageEvent) {
      if (acceptedRef.current) return;
      const data = event.data as { type?: string } | null;
      if (!data || data.type !== BROKER_REQUEST || !event.source) return;
      acceptedRef.current = true;
      requesterRef.current = { source: event.source, origin: event.origin };
      setPhase({ name: 'review', request: data as BrokerRequest, requesterOrigin: event.origin });
    }
    window.addEventListener('message', onMessage);
    // The ready ping carries no data; '*' is fine — we can't know the
    // opener's origin before it speaks.
    window.opener?.postMessage({ type: BROKER_READY }, '*');
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Announce + focus when the review step appears.
  useEffect(() => {
    if (phase.name === 'review') {
      headingRef.current?.focus();
      setAnnouncement(`Publish request received from ${phase.requesterOrigin}. Review and confirm.`);
    }
  }, [phase.name === 'review' ? phase.requesterOrigin : null]); // eslint-disable-line react-hooks/exhaustive-deps

  function reply(result: BrokerResult) {
    const req = requesterRef.current;
    if (req) (req.source as Window).postMessage(result, { targetOrigin: req.origin });
  }

  function cancel() {
    reply({ type: BROKER_RESULT, ok: false, error: 'cancelled' });
    setPhase({ name: 'done', message: 'Cancelled. You can close this window.' });
    setAnnouncement('Cancelled.');
  }

  async function confirm() {
    if (phase.name !== 'review') return;
    const { request, requesterOrigin } = phase;
    if (!agent || !handle) {
      setSignInOpen(true);
      return;
    }
    setPhase({ name: 'publishing', request, requesterOrigin });
    setAnnouncement('Publishing…');
    const pubAgent = agent as unknown as PublishAgent;
    try {
      if (request.action === 'unpublish') {
        await unpublish(request.uri, { agent: pubAgent, handle, dryRun: request.dryRun });
        reply({ type: BROKER_RESULT, ok: true, action: 'unpublish' });
        setPhase({ name: 'done', message: request.dryRun ? 'Dry run — nothing was deleted.' : 'Record removed from your PDS.' });
        setAnnouncement('Unpublished.');
        return;
      }
      // photoBlobs were fetched on the requester's origin (its /uploads
      // are unreachable from here); fall back to a direct fetch for
      // external URLs the broker origin can reach.
      const fetchPhoto = (url: string) =>
        request.photoBlobs?.[url] ? Promise.resolve(request.photoBlobs[url]) : fetchPhotoBlob(url);
      // Adopt-own-records: the requester sends its sourceUrl blind
      // (it has no session); ownership is decided HERE, against the
      // signed-in DID. An explicit rkey (pre-deterministic receipt)
      // still wins.
      const adoptRkey = adoptRkeyFromSource(
        request.adoptUri,
        request.kind === 'recipe' ? LEXICON_RECIPE : LEXICON_COLLECTION,
        pubAgent.did,
      );
      const opts = { agent: pubAgent, handle, dryRun: request.dryRun, rkey: request.rkey ?? adoptRkey ?? undefined, fetchPhoto };

      if (request.kind === 'recipe') {
        const res = await publishRecipe(request.recipe, opts);
        const receipt: BrokerReceipt = { uri: res.uri, cid: res.cid, handle, dryRun: res.dryRun };
        reply({ type: BROKER_RESULT, ok: true, action: 'publish', kind: 'recipe', receipt });
      } else {
        const { collection, recipePublishes } = await publishCollection(
          request.menu,
          (recipeId) => request.existingRefs?.[recipeId] ?? null,
          opts,
        );
        const childReceipts: Record<string, BrokerReceipt> = {};
        for (const p of recipePublishes) {
          if (p.result) childReceipts[p.recipeId] = { uri: p.result.uri, cid: p.result.cid, handle, dryRun: p.result.dryRun };
        }
        const receipt: BrokerReceipt = { uri: collection.uri, cid: collection.cid, handle, dryRun: collection.dryRun };
        reply({ type: BROKER_RESULT, ok: true, action: 'publish', kind: 'menu', receipt, childReceipts });
      }
      setPhase({ name: 'done', message: request.dryRun ? 'Dry run complete — nothing left this device.' : `Published to @${handle}'s PDS.` });
      setAnnouncement(request.dryRun ? 'Dry run complete.' : `Published to @${handle}'s PDS.`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Publish failed';
      reply({ type: BROKER_RESULT, ok: false, error: message });
      setPhase({ name: 'error', message });
      setAnnouncement(`Publish failed: ${message}`);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const recordJson =
    phase.name === 'review' || phase.name === 'publishing'
      ? previewJson(phase.request)
      : null;
  const req = phase.name === 'review' || phase.name === 'publishing' ? phase.request : null;

  return (
    <main id="stage" className="min-h-screen bg-[var(--color-bg-body)] text-[var(--color-text-primary)] px-5 py-6 max-w-xl mx-auto">
      {/* Persistent live region — mounted empty, populated on events,
          so screen readers actually announce them. */}
      <div role="status" className="sr-only">{announcement}</div>

      <header className="flex items-center gap-2 mb-4">
        <Butterfly size={22} weight="light" aria-hidden />
        <h1 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
          {req?.action === 'unpublish' ? 'Remove from Bluesky' : 'Publish to Bluesky'}
        </h1>
        {req?.dryRun && (
          <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold">
            Dry run
          </span>
        )}
      </header>

      {phase.name === 'waiting' && (
        <p className="text-sm text-[var(--color-text-secondary)] pretty">
          {window.opener
            ? 'Waiting for the publish request from the window that opened this one…'
            : 'This window is meant to be opened by a Pantry Host instance when you click Share to Bluesky. There is nothing to do here directly.'}
        </p>
      )}

      {(phase.name === 'review' || phase.name === 'publishing') && req && (
        <>
          {/* Who's asking — the load-bearing line of the whole design. */}
          <p className="text-sm mb-1 pretty">
            <strong className="font-mono text-[13px] break-all">{phase.requesterOrigin}</strong>{' '}
            wants to {req.action === 'unpublish' ? 'remove' : 'publish'}{' '}
            <strong>{req.action === 'unpublish' ? req.title : req.kind === 'recipe' ? req.recipe.title : req.menu.title}</strong>
            {req.action === 'publish' ? <> {req.kind === 'menu' ? 'and its recipes ' : ''}to your PDS</> : ' from your PDS'}.
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mb-1 pretty">
            {isSignedIn ? (
              <>Signed in as <strong>@{handle}</strong>. Nothing happens until you confirm below.</>
            ) : (
              <>Sign in with Bluesky to continue. Nothing happens until you confirm.</>
            )}
          </p>
          {/* Update-vs-create honesty line — ownership of adoptUri can
              only be judged once a session names the DID. */}
          {isSignedIn && did && req.action === 'publish' && (
            <p className="text-xs text-[var(--color-text-secondary)] mb-4 pretty">
              {(() => {
                const updateRkey =
                  req.rkey ??
                  adoptRkeyFromSource(req.adoptUri, req.kind === 'recipe' ? LEXICON_RECIPE : LEXICON_COLLECTION, did);
                return updateRkey ? (
                  <>
                    Updates your existing record{' '}
                    <code className="font-mono text-[11px] break-all">{updateRkey}</code> in place.
                  </>
                ) : (
                  <>Publishes as a new record.</>
                );
              })()}
            </p>
          )}
          {!(isSignedIn && did && req.action === 'publish') && <div className="mb-3" />}

          {req.action === 'publish' && req.kind === 'menu' && (
            <ul className="text-sm mb-3 space-y-1">
              {req.menu.recipes.map((r) => (
                <li key={r.id} className="flex items-center gap-2">
                  <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-bg-card)] border border-[var(--color-border-card)] shrink-0">
                    {req.existingRefs?.[r.id] ? 'Reuse' : 'Publish'}
                  </span>
                  <span className="truncate">{r.title}</span>
                </li>
              ))}
            </ul>
          )}

          {recordJson && (
            <pre className="text-[11px] font-mono leading-relaxed bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-lg p-3 overflow-auto max-h-72 whitespace-pre mb-4">
              {recordJson}
            </pre>
          )}

          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={cancel} className="btn-secondary" disabled={phase.name === 'publishing'}>
              Cancel
            </button>
            {isReady && !isSignedIn ? (
              <button type="button" onClick={() => setSignInOpen(true)} className="btn-primary">
                Sign in with Bluesky
              </button>
            ) : (
              <button type="button" onClick={confirm} className="btn-primary" disabled={!isReady || phase.name === 'publishing'}>
                {phase.name === 'publishing'
                  ? 'Publishing…'
                  : req.action === 'unpublish'
                    ? req.dryRun ? 'Remove (dry run)' : 'Remove'
                    : req.dryRun ? 'Publish (dry run)' : 'Publish'}
              </button>
            )}
          </div>
        </>
      )}

      {phase.name === 'done' && <p className="text-sm pretty">{phase.message} You can close this window.</p>}
      {phase.name === 'error' && (
        <p className="text-sm text-[var(--color-danger)] pretty">{phase.message} — you can close this window and try again.</p>
      )}

      {/* mode="popup": OAuth in a nested popup so THIS page never
          navigates (see handshake note above). */}
      <BlueskySignInModal mode="popup" open={signInOpen} onClose={() => setSignInOpen(false)} />
    </main>
  );
}

/** The exact record JSON that will be written — same honesty rule as
 *  the in-app preview modal. Menus preview with placeholder refs;
 *  real strongRefs are resolved at publish time. */
function previewJson(request: BrokerRequest): string | null {
  if (request.action === 'unpublish') return null;
  if (request.kind === 'recipe') {
    return JSON.stringify(buildRecipeRecord(request.recipe), null, 2);
  }
  const placeholderRefs = request.menu.recipes.map((r) => request.existingRefs?.[r.id] ?? { uri: '(to be minted on publish)', cid: '(tbd)' });
  return JSON.stringify(buildCollectionRecord(request.menu, placeholderRefs), null, 2);
}
