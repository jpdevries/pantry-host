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

import { useMemo, useState } from 'react';
import { Butterfly, CaretDown } from '@phosphor-icons/react';
import BlueskySignInModal from './BlueskySignInModal';
import PublishPreviewModal, { type PreviewMode } from './PublishPreviewModal';
import { useBlueskyAuth } from '../contexts/BlueskyAuth';
import {
  buildCollectionRecord,
  buildRecipeRecord,
  isDryRun,
  publishCollection,
  publishRecipe,
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
};

// ── Component ────────────────────────────────────────────────────────────

export default function PublishToBlueskyButton(props: PublishToBlueskyButtonProps) {
  const { isReady, isSignedIn, agent, handle } = useBlueskyAuth();
  const [signInOpen, setSignInOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const id = props.kind === 'recipe' ? props.recipe.id : props.menu.id;
  const [receipt, setReceipt] = useState<PublishReceipt | null>(() =>
    getPublishReceipt(props.kind, id),
  );

  const dry = isDryRun();

  // Build the preview payload lazily so dry-run mints a fresh
  // synthetic URI per open.
  const previewMode = useMemo<PreviewMode | null>(() => {
    if (!previewOpen) return null;
    if (props.kind === 'recipe') {
      return {
        kind: 'recipe',
        record: buildRecipeRecord(props.recipe),
        existingUri: receipt?.uri,
      };
    }
    // Collection: plan per-child action
    const plan: Extract<PreviewMode, { kind: 'collection' }>['plan'] = props.menu.recipes.map(
      (r) => {
        const childReceipt = getPublishReceipt('recipe', r.id);
        if (childReceipt) {
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
      existingUri: receipt?.uri,
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
          rkey: receipt?.uri ? rkeyFromUri(receipt.uri) ?? undefined : undefined,
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
        props.onPublished?.({ uri: res.uri, cid: res.cid, dryRun: res.dryRun });
      } else {
        const { collection, recipePublishes } = await publishCollection(
          props.menu,
          (recipeId) => {
            const r = getPublishReceipt('recipe', recipeId);
            return r ? { uri: r.uri, cid: r.cid } : null;
          },
          {
            agent: pubAgent,
            handle,
            rkey: receipt?.uri ? rkeyFromUri(receipt.uri) ?? undefined : undefined,
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
        props.onPublished?.({
          uri: collection.uri,
          cid: collection.cid,
          dryRun: collection.dryRun,
        });
      }
      setPreviewOpen(false);
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
      const pubAgent = agent as unknown as PublishAgent;
      await unpublish(receipt.uri, { agent: pubAgent, handle: handle ?? receipt.handle });
      clearPublishReceipt(props.kind, id);
      setReceipt(null);
      setMenuOpen(false);
    } catch (err: any) {
      setError(err?.message ?? 'Unpublish failed');
    } finally {
      setPending(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────

  const iconSize = props.compact ? 16 : 18;

  if (!isReady) {
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

  if (!isSignedIn) {
    return (
      <>
        <button
          type="button"
          onClick={() => setSignInOpen(true)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-[var(--color-border-card)] hover:underline"
          aria-label="Share to Bluesky — sign-in required"
        >
          <Butterfly size={iconSize} weight="light" aria-hidden />
          Share to Bluesky
        </button>
        <BlueskySignInModal open={signInOpen} onClose={() => setSignInOpen(false)} />
      </>
    );
  }

  if (receipt) {
    // Already published — View + dropdown
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
          className="inline-flex items-center px-2 py-1.5 text-sm rounded-r-md border border-l-0 border-[var(--color-border-card)] hover:underline"
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
              onClick={() => {
                setMenuOpen(false);
                setPreviewOpen(true);
              }}
              className="block w-full text-left px-3 py-1.5 hover:underline"
            >
              Re-publish
            </button>
            <button
              type="button"
              role="menuitem"
              disabled={pending}
              onClick={handleUnpublish}
              className="block w-full text-left px-3 py-1.5 hover:underline text-[var(--color-danger)]"
            >
              {pending ? 'Unpublishing…' : dry ? 'Unpublish (dry run)' : 'Unpublish'}
            </button>
          </div>
        )}
        {previewMode && (
          <PublishPreviewModal
            open={previewOpen}
            onClose={() => setPreviewOpen(false)}
            onConfirm={handlePublish}
            mode={previewMode}
            dryRun={dry}
            handle={handle}
            pending={pending}
            error={error}
          />
        )}
      </div>
    );
  }

  // Signed in, not yet published
  return (
    <>
      <button
        type="button"
        onClick={() => setPreviewOpen(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md border border-[var(--color-border-card)] hover:underline"
      >
        <Butterfly size={iconSize} weight="light" aria-hidden />
        Share to Bluesky
        {dry && (
          <span className="text-[9px] uppercase tracking-wider px-1 rounded bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold">
            Dry
          </span>
        )}
      </button>
      {previewMode && (
        <PublishPreviewModal
          open={previewOpen}
          onClose={() => setPreviewOpen(false)}
          onConfirm={handlePublish}
          mode={previewMode}
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
