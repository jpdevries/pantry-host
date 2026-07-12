/**
 * Pre-publish preview — shows the exact JSON record that will be
 * written to the signed-in user's PDS before firing the mutation.
 * Always on: renders whether or not `isDryRun()` is true; the
 * Publish button is the only path forward.
 *
 * For collection publishes, the modal also enumerates every
 * referenced recipe and whether it will be reused (already on the
 * PDS, or resolvable as a strongRef to an imported Bluesky recipe)
 * or published inline — so the user sees the full blast radius
 * before committing.
 *
 * The modal is intentionally plain-text JSON with CSS variables
 * rather than a fancy code-highlighter component — keeps the
 * bundle light and the preview 100% accurate (no tokenizer drift).
 */

import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import { Check, Copy } from '@phosphor-icons/react';
import Modal from './Modal';
import { LEXICON_COLLECTION, LEXICON_RECIPE } from '../atproto-publish';
import type { BlueskyCollectionRecord, BlueskyRecipeRecord } from '../bluesky';

export type PreviewMode =
  | {
      kind: 'recipe';
      record: BlueskyRecipeRecord;
      /** If re-publishing, the existing AT URI so we can show
       *  "Overwriting at …" in the header. */
      existingUri?: string;
    }
  | {
      kind: 'collection';
      record: BlueskyCollectionRecord;
      /** Child recipes and what will happen with each. */
      plan: Array<{
        recipeId: string;
        title: string;
        action: 'reuse-published' | 'reuse-imported' | 'publish-inline';
        /** Upstream AT URI for `reuse-imported` entries. */
        upstreamUri?: string;
      }>;
      existingUri?: string;
    };

/** Receipt for the success step shown after a publish completes. */
export interface PublishSuccessInfo {
  uri: string;
  dryRun: boolean;
  handle: string;
  kind: 'recipe' | 'collection';
  /** Collection publishes: how many child recipes were published
   *  inline ahead of the collection record. */
  inlinePublished?: number;
}

export interface PublishPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: PreviewMode;
  /** Non-null after a successful publish — swaps the preview body
   *  for the confirmation step (status message, copyable AT URI,
   *  share QR). */
  result?: PublishSuccessInfo | null;
  /** True when the modal is sitting on a dry-run-enabled build.
   *  Shown as a banner and woven into the Publish button label. */
  dryRun: boolean;
  /** Handle of the signed-in user — surfaced so it's crystal
   *  clear whose PDS the record lands in. */
  handle: string | null;
  /** Null while ready, string while publishing — disables Confirm
   *  and surfaces loading state. */
  pending: boolean;
  /** Optional error surfaced from the publish attempt. */
  error?: string | null;
}

export default function PublishPreviewModal({
  open,
  onClose,
  onConfirm,
  mode,
  dryRun,
  handle,
  pending,
  error,
  result,
}: PublishPreviewModalProps) {
  // Reset any transient confirm-click state when the modal reopens.
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!open) setConfirmed(false);
  }, [open]);

  const collection = mode.kind === 'collection' ? LEXICON_COLLECTION : LEXICON_RECIPE;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={result ? 'Published to Bluesky' : 'Publish to Bluesky'}
    >
      {/* Persistent live region: mounted (empty) alongside the
          preview, so the success text lands as a *change* to an
          existing region. A live region that first appears already
          containing content is skipped by several screen reader /
          browser combos — this is what makes the announcement
          reliable, not the visible confirmation below. */}
      <div role="status" className="sr-only">
        {result ? announcementFor(result) : ''}
      </div>
      {result ? (
        <PublishSuccessStep result={result} onClose={onClose} />
      ) : (
      <div className="flex flex-col max-h-[85vh]">
        {/* Header */}
        <header className="px-5 pt-5 pb-3 border-b border-[var(--color-border-card)]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-bold mb-1">
                {mode.existingUri ? 'Re-publish to Bluesky' : 'Publish to Bluesky'}
              </h2>
              <p className="text-xs text-[var(--color-text-secondary)] pretty">
                {handle ? (
                  <>
                    Signed in as <strong>@{handle}</strong> — record will be
                    written to <code className="text-[11px]">{collection}</code>.
                  </>
                ) : (
                  <>Sign-in required to publish.</>
                )}
              </p>
            </div>
            {dryRun && (
              <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded-md bg-[var(--color-warning-bg)] text-[var(--color-warning)] font-semibold shrink-0">
                Dry run
              </span>
            )}
          </div>
          {mode.kind === 'collection' && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-2 pretty">
              {describeCollectionPlan(mode.plan)}
            </p>
          )}
          {mode.kind === 'recipe' && mode.record.attribution && (
            <p className="text-xs text-[var(--color-text-secondary)] mt-2 pretty">
              {describeAttribution(mode.record.attribution)}
            </p>
          )}
        </header>

        {/* Body — scrollable */}
        <div className="overflow-y-auto px-5 py-4 flex-1 space-y-4">
          {mode.kind === 'collection' && (
            <section>
              <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
                Referenced recipes
              </h3>
              <ul className="space-y-1.5 text-sm">
                {mode.plan.map((p) => (
                  <li key={p.recipeId} className="flex items-center gap-2">
                    <ActionBadge action={p.action} />
                    <span className="flex-1 min-w-0 truncate">{p.title}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
              Record payload
            </h3>
            <pre className="text-[11px] font-mono leading-relaxed bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-lg p-3 overflow-x-auto whitespace-pre">
              {JSON.stringify({ $type: collection, ...mode.record }, null, 2)}
            </pre>
          </section>
        </div>

        {/* Footer */}
        <footer className="px-5 pt-3 pb-4 border-t border-[var(--color-border-card)] flex items-center justify-end gap-2">
          {error && (
            <span className="text-xs text-[var(--color-danger)] flex-1 pretty">
              {error}
            </span>
          )}
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-sm rounded-md border border-[var(--color-border-card)] hover:underline"
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmed(true);
              onConfirm();
            }}
            disabled={pending || !handle}
            className="px-3 py-1.5 text-sm rounded-md bg-[var(--color-accent)] text-[var(--color-bg-body)] font-semibold disabled:bg-[var(--color-bg-card)] disabled:text-[var(--color-text-secondary)] disabled:border disabled:border-[var(--color-border-card)]"
          >
            {pending
              ? 'Publishing…'
              : dryRun
              ? 'Publish (dry run)'
              : confirmed
              ? 'Publishing…'
              : mode.existingUri
              ? 'Re-publish'
              : 'Publish'}
          </button>
        </footer>
      </div>
      )}
    </Modal>
  );
}

/** Turn an at:// URI into the app's own shareable detail URL —
 *  both tiers serve /at/{did}/{collection}/{rkey}. */
function atUriToSharePath(uri: string): string | null {
  const parts = uri.replace(/^at:\/\//, '').split('/');
  if (parts.length !== 3) return null;
  return `/at/${parts[0]}/${parts[1]}/${parts[2]}#stage`;
}

/** Screen-reader announcement injected into the persistent live
 *  region when the publish completes. Mirrors the visible copy. */
function announcementFor(result: PublishSuccessInfo): string {
  const what =
    result.kind === 'collection'
      ? result.inlinePublished
        ? `${result.inlinePublished} recipe${result.inlinePublished === 1 ? '' : 's'} and the collection`
        : 'The collection'
      : 'The recipe';
  return result.dryRun
    ? `Dry run complete. ${what} would have been written to @${result.handle}'s PDS. Nothing left this device.`
    : `Published to Bluesky. ${what} ${result.kind === 'collection' && result.inlinePublished ? 'were' : 'was'} written to @${result.handle}'s PDS.`;
}

function PublishSuccessStep({
  result,
  onClose,
}: {
  result: PublishSuccessInfo;
  onClose: () => void;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');

  const sharePath = atUriToSharePath(result.uri);
  const shareUrl =
    !result.dryRun && sharePath && typeof window !== 'undefined'
      ? `${window.location.origin}${sharePath}`
      : null;

  // Announce + move focus so the confirmation is heard, not just seen.
  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!shareUrl) return;
    // PNG data URL at 2× the rendered 112px so it stays crisp on
    // retina. (Raw SVG needs [&>svg] sizing — Rex can't scan those
    // variants out of shared components; see CLAUDE.md gotcha #10.)
    QRCode.toDataURL(shareUrl, {
      width: 224,
      margin: 2,
      color: { dark: '#000000', light: '#ffffff' },
    }).then(setQrDataUrl);
  }, [shareUrl]);

  async function handleCopy() {
    await navigator.clipboard.writeText(result.uri);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const what =
    result.kind === 'collection'
      ? result.inlinePublished
        ? `${result.inlinePublished} recipe${result.inlinePublished === 1 ? '' : 's'} and the collection`
        : 'The collection'
      : 'The recipe';

  return (
    <div className="flex flex-col max-h-[85vh]">
      {/* Announcement is handled by the persistent live region in
          the parent — no role=status here or it would double-fire. */}
      <div className="px-5 pt-5 pb-4 space-y-3">
        <h2 ref={headingRef} tabIndex={-1} className="text-lg font-bold outline-none">
          {result.dryRun ? 'Dry run complete' : 'Published to Bluesky'}
        </h2>
        <p className="text-sm text-[var(--color-text-secondary)] pretty">
          {result.dryRun ? (
            <>
              {what} would have been written to <strong>@{result.handle}</strong>&rsquo;s PDS.
              Nothing left this device — the receipt below is local only.
            </>
          ) : (
            <>
              {what} {result.kind === 'collection' && result.inlinePublished ? 'were' : 'was'}{' '}
              written to <strong>@{result.handle}</strong>&rsquo;s PDS.
            </>
          )}
        </p>
      </div>

      <div className="overflow-y-auto px-5 pb-4 flex-1 space-y-4">
        <section>
          <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
            AT URI
          </h3>
          <div className="flex items-center gap-2">
            <code className="text-[11px] font-mono flex-1 min-w-0 truncate bg-[var(--color-bg-card)] border border-[var(--color-border-card)] rounded-lg px-3 py-2">
              {result.uri}
            </code>
            <button
              type="button"
              onClick={handleCopy}
              className="btn-secondary px-3 py-1.5 shrink-0"
              aria-label="Copy AT URI"
            >
              {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        </section>

        {shareUrl && (
          <section>
            <h3 className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
              Share
            </h3>
            <div className="flex items-start gap-4">
              {qrDataUrl && (
                <img
                  src={qrDataUrl}
                  alt=""
                  aria-hidden="true"
                  className="w-28 h-28 shrink-0 rounded-lg border border-[var(--color-border-card)]"
                />
              )}
              <p className="text-xs text-[var(--color-text-secondary)] pretty">
                Scan to open the published record on another device, or share the link:{' '}
                <a href={sharePath!} className="underline break-all">
                  {shareUrl}
                </a>
              </p>
            </div>
          </section>
        )}
      </div>

      <footer className="px-5 pt-3 pb-4 border-t border-[var(--color-border-card)] flex justify-end">
        <button type="button" onClick={onClose} className="btn-secondary px-3 py-1.5">
          Done
        </button>
      </footer>
    </div>
  );
}

function ActionBadge({ action }: { action: 'reuse-published' | 'reuse-imported' | 'publish-inline' }) {
  const label = {
    'reuse-published': 'Reuse',
    'reuse-imported': 'Cite',
    'publish-inline': 'Publish',
  }[action];
  const title = {
    'reuse-published': 'Already on your PDS — strongRef will be reused.',
    'reuse-imported': 'Imported from Bluesky — will be cited as a strongRef, not re-published.',
    'publish-inline': 'Will be published first, then referenced.',
  }[action];
  return (
    <span
      title={title}
      className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-[var(--color-bg-card)] border border-[var(--color-border-card)] shrink-0"
    >
      {label}
    </span>
  );
}

type CollectionPlan = Extract<PreviewMode, { kind: 'collection' }>['plan'];

function describeCollectionPlan(plan: CollectionPlan): string {
  const publishCount = plan.filter((p) => p.action === 'publish-inline').length;
  const totalRecords = publishCount + 1; // +1 for the collection itself
  if (publishCount === 0) {
    return `All referenced recipes already resolve — this is 1 record total.`;
  }
  return `This will publish ${publishCount} recipe${publishCount === 1 ? '' : 's'} followed by 1 collection (${totalRecords} records total).`;
}

function describeAttribution(attribution: BlueskyRecipeRecord['attribution']): string {
  if (!attribution) return '';
  const anyAttr = attribution as { originalUri?: string; sourceUrl?: string };
  if (anyAttr.originalUri) {
    return `This will be published as an adaptation of the original Bluesky recipe at ${anyAttr.originalUri}.`;
  }
  if (anyAttr.sourceUrl) {
    return `This will be published as an adaptation of the source at ${anyAttr.sourceUrl}.`;
  }
  return 'Attribution recorded.';
}
