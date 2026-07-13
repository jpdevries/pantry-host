/**
 * Share-to-Bluesky button for recipe & menu detail pages.
 *
 * States:
 *   - Not signed in             → opens BlueskySignInModal
 *   - Signed in, not published  → opens PublishPreviewModal
 *   - Signed in, already published → "View on Bluesky" link with
 *     a subtle caret that reveals Re-publish / Unpublish
 *
 * The caller passes either a `recipe` or `menu` prop (discriminated
 * union). Menu publishes need a `menuLookupRecipe` function so the
 * component can resolve published receipts for the menu's child
 * recipes without this module owning a GraphQL dependency.
 *
 * Dry-run: all real PDS writes honor `isDryRun()` from
 * `atproto-publish.ts`. The preview modal carries the dry-run badge
 * so the UI is honest about what's about to happen.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Butterfly, CaretDown } from '@phosphor-icons/react';
import BlueskySignInModal from './BlueskySignInModal';
import PublishPreviewModal, {
  type PreviewMode,
  type PublishSuccessInfo,
} from './PublishPreviewModal';
import { useBlueskyAuth } from '../contexts/BlueskyAuth';
import {
  buildCollectionRecord,
  buildRecipeRecord,
  findPublishedRecord,
  isDryRun,
  LEXICON_COLLECTION,
  LEXICON_RECIPE,
  publishCollection,
  publishRecipe,
  recordExists,
  rkeyFromUri,
  unpublish,
  type PublishableMenu,
  type PublishableRecipe,
  type PublishAgent,
} from '../atproto-publish';
import {
  clearPublishReceipt,
  getPublishReceipt,
  setPublishReceipt,
  type PublishReceipt,
} from '../pds-published';
import {
  BROKER_REQUEST,
  collectPhotoBlobs,
  publishViaBroker,
  shouldUseBroker,
  type BrokerRequest,
  type BrokerResult,
} from '../atproto-broker';

// ── Props ────────────────────────────────────────────────────────────────

interface RecipeProps {
  kind: 'recipe';
  recipe: PublishableRecipe;
}

interface MenuProps {
  kind: 'menu';
  menu: PublishableMenu;
}

export type PublishToBlueskyButtonProps = (RecipeProps | MenuProps) & {
  /** Compact variant for toolbars where a full row of CTA cards
   *  is overkill — still shows an icon + label but tighter. */
  compact?: boolean;
  /** Optional callback after a successful publish, e.g. to show a
   *  toast or re-render the page. */
  onPublished?: (result: { uri: string; cid: string; dryRun: boolean }) => void;
  /** Override how `photoUrl` resolves to image bytes — the web PWA
   *  passes an OPFS-aware resolver for its `opfs://` scheme. Omit
   *  for the default plain-fetch resolver. */
  fetchPhoto?: (photoUrl: string) => Promise<Blob | null>;
};

// ── Component ────────────────────────────────────────────────────────────

export default function PublishToBlueskyButton(props: PublishToBlueskyButtonProps) {
  const { isReady, isSignedIn, agent, handle } = useBlueskyAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Non-null after a successful publish — keeps the modal open on
  // its confirmation step instead of silently closing.
  const [publishResult, setPublishResult] = useState<PublishSuccessInfo | null>(null);

  const id = props.kind === 'recipe' ? props.recipe.id : props.menu.id;
  const [receipt, setReceipt] = useState<PublishReceipt | null>(() =>
    getPublishReceipt(props.kind, id),
  );

  const dry = isDryRun();
  // On origins that can't complete AT OAuth themselves (LAN, Tailscale,
  // plain HTTP — see issue #37), publishing routes through a popup on
  // the hosted origin instead of the local sign-in + preview modals.
  const viaBroker = shouldUseBroker();

  // Reconcile local state against the PDS (the real cross-device source
  // of truth) once the session is ready. Runs at most once per item per
  // sign-in. localStorage is a fast optimistic cache; the PDS decides.
  //  - a real receipt that no longer resolves (deleted elsewhere) is cleared
  //  - with no receipt, a record at the deterministic rkey is adopted,
  //    so a second device / cleared cache shows "View on Bluesky"
  // Skipped in dry-run: synthetic receipts don't resolve on any PDS.
  // Broker origins have no local session, but `recordExists` is a
  // public read — stale-receipt cleanup still runs there. Adoption
  // needs a DID, which only a session provides, so it stays gated.
  const reconciledRef = useRef(false);
  useEffect(() => {
    if (dry || reconciledRef.current) return;
    let local = getPublishReceipt(props.kind, id);
    // A leftover dry receipt (from a previous dry-run session) is
    // meaningless in real mode — its DRYRUN- record exists nowhere.
    // Purge it so the CTA doesn't claim a published state that isn't.
    if (local?.dryRun) {
      clearPublishReceipt(props.kind, id);
      setReceipt(null);
      local = null;
    }
    let cancelled = false;

    if (!isSignedIn || !agent) {
      if (!viaBroker || !local) return;
      reconciledRef.current = true;
      (async () => {
        const stillThere = await recordExists(local.uri);
        if (!cancelled && !stillThere) {
          clearPublishReceipt(props.kind, id);
          setReceipt(null);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    reconciledRef.current = true;
    const did = (agent as unknown as PublishAgent).did;
    const collection = props.kind === 'recipe' ? LEXICON_RECIPE : LEXICON_COLLECTION;
    (async () => {
      if (local) {
        // Always a real receipt here — dry ones were purged above.
        const stillThere = await recordExists(local.uri);
        if (cancelled) return;
        if (!stillThere) {
          clearPublishReceipt(props.kind, id);
          setReceipt(null);
        }
        return;
      }
      if (!local) {
        const found = await findPublishedRecord(did, collection, id);
        if (cancelled || !found) return;
        const adopted: PublishReceipt = {
          uri: found.uri,
          cid: found.cid,
          publishedAt: new Date().toISOString(),
          handle: handle ?? '',
          dryRun: false,
        };
        setPublishReceipt(props.kind, id, adopted);
        setReceipt(adopted);
      }
    })();
    return () => {
      cancelled = true;
    };
    // id/kind identify the item; agent+isSignedIn gate readiness. receipt
    // is intentionally excluded — the ref guards against re-runs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSignedIn, agent, id, props.kind, dry, viaBroker]);

  /** A receipt only counts as "already on the PDS" if it came from a
   *  real publish — or if this run is itself a dry run (all pretend,
   *  so pretend-reuse is consistent). A real publish must never
   *  reuse a dry receipt: its DRYRUN- uri / synthetic cid point at a
   *  record that doesn't exist on any PDS. */
  const usableReceipt = (r: PublishReceipt | null): r is PublishReceipt =>
    r !== null && (dry || !r.dryRun);

  // Build the preview payload lazily so dry-run mints a fresh
  // synthetic URI per open.
  const previewMode = useMemo<PreviewMode | null>(() => {
    if (!previewOpen) return null;
    if (props.kind === 'recipe') {
      return {
        kind: 'recipe',
        record: buildRecipeRecord(props.recipe),
        existingUri: usableReceipt(receipt) ? receipt.uri : undefined,
      };
    }
    // Collection: plan per-child action
    const plan: Extract<PreviewMode, { kind: 'collection' }>['plan'] = props.menu.recipes.map(
      (r) => {
        const childReceipt = getPublishReceipt('recipe', r.id);
        if (usableReceipt(childReceipt)) {
          return { recipeId: r.id, title: r.title, action: 'reuse-published' };
        }
        if (r.sourceUrl?.startsWith('at://')) {
          return {
            recipeId: r.id,
            title: r.title,
            action: 'reuse-imported',
            upstreamUri: r.sourceUrl,
          };
        }
        return { recipeId: r.id, title: r.title, action: 'publish-inline' };
      },
    );
    // For the preview, we synthesize strongRefs the same way the
    // publishCollection flow will — but using placeholder CIDs so
    // the JSON is representative rather than accurate. The modal
    // makes clear which children will be published.
    const placeholderRefs = plan.map((p) => {
      if (p.action === 'reuse-imported' && p.upstreamUri) {
        return { uri: p.upstreamUri, cid: 'bafy…' };
      }
      if (p.action === 'reuse-published') {
        const r = getPublishReceipt('recipe', p.recipeId)!;
        return { uri: r.uri, cid: r.cid };
      }
      return { uri: '(to be minted on publish)', cid: '(tbd)' };
    });
    return {
      kind: 'collection',
      record: buildCollectionRecord(props.menu, placeholderRefs),
      plan,
      existingUri: usableReceipt(receipt) ? receipt.uri : undefined,
    };
    // `receipt` kept for `existingUri` — other deps implicitly
    // handled by `previewOpen` toggling.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewOpen, receipt, props.kind, props.kind === 'recipe' ? props.recipe : props.menu]);

  async function handlePublish() {
    if (!agent || !handle) {
      setError('Sign-in required.');
      return;
    }
    setError(null);
    setPending(true);
    try {
      const pubAgent = agent as unknown as PublishAgent;
      if (props.kind === 'recipe') {
        const res = await publishRecipe(props.recipe, {
          agent: pubAgent,
          handle,
          // A dry receipt's DRYRUN- rkey must not leak into a real
          // putRecord — fall through to createRecord instead.
          rkey: usableReceipt(receipt) ? rkeyFromUri(receipt.uri) ?? undefined : undefined,
          fetchPhoto: props.fetchPhoto,
        });
        const newReceipt: PublishReceipt = {
          uri: res.uri,
          cid: res.cid,
          publishedAt: new Date().toISOString(),
          handle,
          dryRun: res.dryRun,
        };
        setPublishReceipt('recipe', props.recipe.id, newReceipt);
        setReceipt(newReceipt);
        setPublishResult({ uri: res.uri, dryRun: res.dryRun, handle, kind: 'recipe' });
        props.onPublished?.({ uri: res.uri, cid: res.cid, dryRun: res.dryRun });
      } else {
        const { collection, recipePublishes } = await publishCollection(
          props.menu,
          (recipeId) => {
            const r = getPublishReceipt('recipe', recipeId);
            return usableReceipt(r) ? { uri: r.uri, cid: r.cid } : null;
          },
          {
            agent: pubAgent,
            handle,
            rkey: usableReceipt(receipt) ? rkeyFromUri(receipt.uri) ?? undefined : undefined,
            fetchPhoto: props.fetchPhoto,
          },
        );
        // Record every recipe we inline-published so the next
        // collection publish can reuse them.
        const now = new Date().toISOString();
        for (const p of recipePublishes) {
          if (!p.result) continue; // reused / cited — no new receipt
          setPublishReceipt('recipe', p.recipeId, {
            uri: p.result.uri,
            cid: p.result.cid,
            publishedAt: now,
            handle,
            dryRun: p.result.dryRun,
          });
        }
        const newReceipt: PublishReceipt = {
          uri: collection.uri,
          cid: collection.cid,
          publishedAt: now,
          handle,
          dryRun: collection.dryRun,
        };
        setPublishReceipt('menu', props.menu.id, newReceipt);
        setReceipt(newReceipt);
        setPublishResult({
          uri: collection.uri,
          dryRun: collection.dryRun,
          handle,
          kind: 'collection',
          inlinePublished: recipePublishes.filter((p) => p.result).length,
        });
        props.onPublished?.({
          uri: collection.uri,
          cid: collection.cid,
          dryRun: collection.dryRun,
        });
      }
      // Modal stays open — it flips to the confirmation step now
      // that publishResult is set.
    } catch (err: any) {
      setError(err?.message ?? 'Publish failed');
    } finally {
      setPending(false);
    }
  }

  async function handleUnpublish() {
    if (!agent || !receipt) return;
    setPending(true);
    setError(null);
    try {
      // A dry receipt points at a record that was never written —
      // there's nothing to delete on the PDS. Just clear locally.
      if (!receipt.dryRun) {
        const pubAgent = agent as unknown as PublishAgent;
        await unpublish(receipt.uri, { agent: pubAgent, handle: handle ?? receipt.handle });
      }
      clearPublishReceipt(props.kind, id);
      setReceipt(null);
      setMenuOpen(false);
    } catch (err: any) {
      setError(err?.message ?? 'Unpublish failed');
    } finally {
      setPending(false);
    }
  }

  // ── Broker mode (self-hosted origins that can't do AT OAuth) ──────────
  // Sign-in, preview, and the confirm click all happen inside the popup
  // on the hosted origin; this side only sends the payload and stores
  // the receipts that come back. See shared/atproto-broker.ts.

  function applyBrokerResult(res: BrokerResult) {
    if (!res.ok) {
      // A closed popup is a deliberate "no" — not an error to shout about.
      if (res.error !== 'cancelled') setError(res.error);
      return;
    }
    if (res.action === 'unpublish') {
      clearPublishReceipt(props.kind, id);
      setReceipt(null);
      return;
    }
    const now = new Date().toISOString();
    if (res.childReceipts) {
      for (const [recipeId, cr] of Object.entries(res.childReceipts)) {
        setPublishReceipt('recipe', recipeId, {
          uri: cr.uri,
          cid: cr.cid,
          publishedAt: now,
          handle: cr.handle,
          dryRun: cr.dryRun,
        });
      }
    }
    const newReceipt: PublishReceipt = {
      uri: res.receipt.uri,
      cid: res.receipt.cid,
      publishedAt: now,
      handle: res.receipt.handle,
      dryRun: res.receipt.dryRun,
    };
    setPublishReceipt(props.kind, id, newReceipt);
    setReceipt(newReceipt);
    // Open the modal straight onto its confirmation step (AT URI,
    // copy button, QR) — the popup already closed.
    setPublishResult({
      uri: newReceipt.uri,
      dryRun: newReceipt.dryRun,
      handle: newReceipt.handle,
      kind: props.kind === 'recipe' ? 'recipe' : 'collection',
      inlinePublished: res.childReceipts ? Object.keys(res.childReceipts).length : undefined,
    });
    setPreviewOpen(true);
    props.onPublished?.({ uri: newReceipt.uri, cid: newReceipt.cid, dryRun: newReceipt.dryRun });
  }

  function handleBrokerPublish() {
    setError(null);
    setMenuOpen(false);
    // publishViaBroker opens the popup synchronously on this click;
    // the payload promise (photo Blob collection) resolves while the
    // popup loads and is delivered on its ready ping.
    const request = (async (): Promise<BrokerRequest> => {
      const rkey = usableReceipt(receipt) ? rkeyFromUri(receipt.uri) ?? undefined : undefined;
      if (props.kind === 'recipe') {
        const photoBlobs = await collectPhotoBlobs([props.recipe.photoUrl], props.fetchPhoto);
        return { type: BROKER_REQUEST, action: 'publish', kind: 'recipe', recipe: props.recipe, rkey, photoBlobs, dryRun: dry };
      }
      const existingRefs: Record<string, { uri: string; cid: string }> = {};
      for (const r of props.menu.recipes) {
        const cr = getPublishReceipt('recipe', r.id);
        if (usableReceipt(cr)) existingRefs[r.id] = { uri: cr.uri, cid: cr.cid };
      }
      const photoBlobs = await collectPhotoBlobs(props.menu.recipes.map((r) => r.photoUrl), props.fetchPhoto);
      return { type: BROKER_REQUEST, action: 'publish', kind: 'menu', menu: props.menu, rkey, existingRefs, photoBlobs, dryRun: dry };
    })();
    setPending(true);
    publishViaBroker(request).then((res) => {
      setPending(false);
      applyBrokerResult(res);
    });
  }

  function handleBrokerUnpublish() {
    if (!receipt) return;
    setMenuOpen(false);
    // Dry receipts never reached a PDS — clear locally, no popup.
    if (receipt.dryRun) {
      clearPublishReceipt(props.kind, id);
      setReceipt(null);
      return;
    }
    setError(null);
    setPending(true);
    publishViaBroker({
      type: BROKER_REQUEST,
      action: 'unpublish',
      kind: props.kind,
      uri: receipt.uri,
      title: props.kind === 'recipe' ? props.recipe.title : props.menu.title,
      dryRun: dry,
    }).then((res) => {
      setPending(false);
      applyBrokerResult(res);
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const iconSize = props.compact ? 16 : 18;

  // Broker mode has no local session — auth readiness and sign-in live
  // in the popup, so those gates only apply to the direct flow.
  if (!viaBroker && !isReady) {
    return (
      <button
        type="button"
        disabled
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-[var(--color-border-card)] opacity-50"
      >
        <Butterfly size={iconSize} weight="light" aria-hidden />
        Loading…
      </button>
    );
  }

  if (!viaBroker && !isSignedIn) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSignInOpen(true)}
          className={`btn-secondary ${props.compact ? 'px-3 py-1.5' : ''}`}
          aria-label="Share to Bluesky — sign-in required"
        >
          <Butterfly size={iconSize} weight="light" aria-hidden />
          Share to Bluesky
        </button>
        <BlueskySignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      </>
    );
  }

  if (usableReceipt(receipt)) {
    // Already published — View + dropdown. Gated on usableReceipt,
    // not the raw receipt: in real mode a leftover dry receipt must
    // render as "not published", same rule as reuse/rkey above.
    const bskyUrl = atUriToBskyAppUrl(receipt.uri, receipt.handle);
    return (
      <div className="relative inline-flex">
        <a
          href={bskyUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-l-md border border-[var(--color-border-card)] hover:underline"
          title={receipt.dryRun ? 'Dry-run receipt — link will not resolve.' : `Published to @${receipt.handle}`}
        >
          <Butterfly size={iconSize} weight="light" aria-hidden />
          View on Bluesky
          {receipt.dryRun && (
            <span className="text-[9px] uppercase tracking-wider px-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold">
              Dry
            </span>
          )}
        </a>
        <button
          type="button"
          onClick={() => setMenuOpen((o: boolean) => !o)}
          aria-label="Publish options"
          aria-expanded={menuOpen}
          className="inline-flex items-center px-2 py-1.5 text-sm rounded-r-md border border-l-0 border-[var(--color-border-card)] cursor-pointer hover:underline"
        >
          <CaretDown size={iconSize} weight="light" aria-hidden />
        </button>
        {menuOpen && (
          <div
            role="menu"
            className="absolute right-0 top-full mt-1 z-10 min-w-[10rem] rounded-md border border-[var(--color-border-card)] bg-[var(--color-bg-card)] shadow-lg py-1 text-sm"
          >
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={() => {
                if (viaBroker) {
                  handleBrokerPublish();
                  return;
                }
                setMenuOpen(false);
                setPreviewOpen(true);
              }}
              className="block w-full text-left px-3 py-1.5 cursor-pointer hover:underline"
            >
              Re-publish
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={viaBroker ? handleBrokerUnpublish : handleUnpublish}
              className="block w-full text-left px-3 py-1.5 cursor-pointer hover:underline text-[var(--color-danger)]"
            >
              {pending ? 'Unpublishing…' : dry ? 'Unpublish (dry run)' : 'Unpublish'}
            </button>
          </div>
        )}
        {viaBroker && error && (
          <span role="alert" className="absolute left-0 top-full mt-1 text-xs text-[var(--color-danger)] whitespace-nowrap pretty">
            {error}
          </span>
        )}
        {previewMode && (
          <PublishPreviewModal
            open={previewOpen}
            onClose={() => {
              setPreviewOpen(false);
              setPublishResult(null);
            }}
            onConfirm={handlePublish}
            mode={previewMode}
            result={publishResult}
            dryRun={dry}
            handle={handle}
            pending={pending}
            error={error}
          />
        )}
      </div>
    );
  }

  // Not yet published: signed in (direct flow) or broker mode (auth
  // and preview live in the popup on the hosted origin).
  return (
    <>
      <button
        type="button"
        disabled={pending}
        onClick={() => (viaBroker ? handleBrokerPublish() : setPreviewOpen(true))}
        className={`btn-secondary ${props.compact ? 'px-3 py-1.5' : ''}`}
      >
        <Butterfly size={iconSize} weight="light" aria-hidden />
        {pending && viaBroker ? 'Waiting for publish window…' : 'Share to Bluesky'}
        {dry && (
          <span className="text-[9px] uppercase tracking-wider px-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold">
            Dry
          </span>
        )}
      </button>
      {viaBroker && error && (
        <span role="alert" className="block mt-2 text-xs text-[var(--color-danger)] pretty">
          {error}
        </span>
      )}
      {previewMode && (
        <PublishPreviewModal
          open={previewOpen}
          onClose={() => {
            setPreviewOpen(false);
            setPublishResult(null);
          }}
          onConfirm={handlePublish}
          mode={previewMode}
          result={publishResult}
          dryRun={dry}
          handle={handle}
          pending={pending}
          error={error}
        />
      )}
    </>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────

/** at://did/exchange.recipe.recipe/rkey → bsky.app URL. Bluesky's
 *  public app doesn't render `exchange.recipe.*` records yet, so
 *  this link points to the profile + URI for inspection. */
function atUriToBskyAppUrl(uri: string, handle: string): string {
  if (uri.includes('DRYRUN-')) return `#dry-run-${encodeURIComponent(uri)}`;
  const rkey = rkeyFromUri(uri);
  // Fall back to the profile page if we can't parse the rkey.
  if (!rkey) return `https://bsky.app/profile/${handle}`;
  // bsky.app surfaces a generic record viewer via the PDS inspect
  // path. Until they support the lexicon, the profile link is the
  // most useful landing.
  return `https://bsky.app/profile/${handle}`;
}
