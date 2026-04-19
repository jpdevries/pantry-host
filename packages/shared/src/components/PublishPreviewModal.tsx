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

import { useEffect, useState } from 'react';
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

export interface PublishPreviewModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  mode: PreviewMode;
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
}: PublishPreviewModalProps) {
  // Reset any transient confirm-click state when the modal reopens.
  const [confirmed, setConfirmed] = useState(false);
  useEffect(() => {
    if (!open) setConfirmed(false);
  }, [open]);

  const collection = mode.kind === 'collection' ? LEXICON_COLLECTION : LEXICON_RECIPE;

  return (
    <Modal open={open} onClose={onClose} title="Publish to Bluesky">
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
    </Modal>
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
