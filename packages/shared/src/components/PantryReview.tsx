/**
 * PantryReview — reconcile the pantry in one sitting.
 *
 * Runs `reviewPantry` over the kitchen's rows and lays the findings out as
 * one fieldset per signal (expired, expiring, possibly stale, likely
 * duplicates, out of stock). Each row is a checkbox; the actions live in a
 * single sticky bar, so a 60-row review is about 70 tab stops, not 240.
 * Duplicate groups get their own survivor radio and Merge button, with the
 * outcome previewed through `planMerge` before anything is written.
 *
 * Both tiers render this with their own `gql` client and link component.
 * Owner-only in the app: the caller passes `canEdit`.
 */

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import RelativeTime from './RelativeTime';
import {
  describeBasis,
  estimatedExpiry,
  planMerge,
  reviewPantry,
  REVIEW_SIGNAL_LABELS,
  REVIEW_SIGNALS,
  type PantryRowForReview,
  type ReviewFinding,
  type ReviewSignal,
} from '../pantry-review';
import type { GqlClient } from './CookPreviewModal';

const REVIEW_QUERY = `
  query PantryReview($kitchenSlug: String) {
    ingredients(kitchenSlug: $kitchenSlug) {
      id name aliases category quantity unit itemSize itemSizeUnit alwaysOnHand tags barcode productMeta
      expiresAt stockedAt updatedAt createdAt
    }
  }
`;
const TOUCH = `mutation Touch($ids: [String!]!) { touchIngredients(ids: $ids) { id } }`;
const UPDATE_MANY = `mutation UpdateMany($inputs: [IngredientPatchInput!]!) { updateIngredients(inputs: $inputs) { id } }`;
const DELETE_MANY = `mutation DeleteMany($ids: [String!]!) { deleteIngredients(ids: $ids) }`;
const MERGE = `
  mutation Merge($survivorId: String!, $mergeIds: [String!]!) {
    mergeIngredients(survivorId: $survivorId, mergeIds: $mergeIds) { ingredient { id name } mergedIds unmergedQuantities }
  }
`;

export type LinkRenderer = (props: { href: string; className?: string; children: ReactNode }) => ReactNode;
const defaultLink: LinkRenderer = ({ href, className, children }) => <a href={href} className={className}>{children}</a>;

interface Props {
  gql: GqlClient;
  kitchenSlug: string;
  /** Where "Back to pantry" goes. */
  pantryHref: string;
  /** False for read-only guests: findings show, actions don't. */
  canEdit: boolean;
  renderLink?: LinkRenderer;
}

const SIGNAL_BLURB: Record<ReviewSignal, string> = {
  expired: 'Past a stated best-by date, or past the estimate for its category.',
  expiring: 'Best-by within three days. Worth cooking with first.',
  stale: 'No best-by date and no estimate for its category, and untouched for six months. Still here?',
  duplicate: 'Rows that look like the same item. Merging sums quantities, keeps every tag, and makes the other names aliases of the one you keep.',
  outOfStock: 'At zero for two weeks or more. Delete them, or restock from the pantry page.',
};

function fmtQty(r: PantryRowForReview): string {
  if (r.alwaysOnHand) return 'always on hand';
  if (r.quantity == null) return '';
  const q = Number.isInteger(r.quantity) ? String(r.quantity) : String(Math.round(r.quantity * 100) / 100);
  return `${q}${r.unit ? ` ${r.unit}` : ''}${r.itemSize != null ? ` × ${r.itemSize}${r.itemSizeUnit ? ` ${r.itemSizeUnit}` : ''}` : ''}`;
}

/** The finding's reason as markup: dates become `<time>` elements with the
 *  relative phrase as text and the absolute date behind them, so assistive
 *  tech and parsers get the real value. `finding.reason` stays the plain
 *  text for the MCP tool. */
function Reason({ f, row, now }: { f: ReviewFinding; row: PantryRowForReview; now: number }) {
  const stocked = f.since ? <RelativeTime iso={f.since} now={now} /> : null;
  switch (f.signal) {
    case 'expired':
      return (
        <>
          {f.provenance === 'explicit' ? 'Best-by passed ' : 'Estimated best-by passed '}
          {f.date && <RelativeTime iso={f.date} now={now} />}
          {' ('}
          {f.provenance === 'explicit' ? 'stated' : f.basis ? describeBasis(f.basis) : 'estimated'}
          {stocked && <>, stocked {stocked}</>}
          {')'}
        </>
      );
    case 'expiring':
      return (
        <>
          {f.provenance === 'explicit' ? 'Best by ' : 'Estimated best by '}
          {f.date && <RelativeTime iso={f.date} now={now} />}
          {' ('}
          {f.provenance === 'explicit' ? 'stated' : f.basis ? describeBasis(f.basis) : 'estimated'}
          {stocked && <>, stocked {stocked}</>}
          {')'}
        </>
      );
    case 'stale':
      return (
        <>
          Untouched since {stocked ?? '?'}; no shelf-life estimate for {row.category ?? 'uncategorised'} items
        </>
      );
    case 'outOfStock':
      return <>Out of stock since {stocked ?? '?'}</>;
    default:
      return <>{f.reason}</>;
  }
}

export default function PantryReview({ gql, kitchenSlug, pantryHref, canEdit, renderLink = defaultLink }: Props) {
  const [rows, setRows] = useState<PantryRowForReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showExpiry, setShowExpiry] = useState(false);
  const [expiryValue, setExpiryValue] = useState('');
  const [survivors, setSurvivors] = useState<Record<string, string>>({});
  const [confirmMerge, setConfirmMerge] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; inputs: { id: string; quantity: number | null }[] } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  const load = useCallback(async () => {
    try {
      const data = await gql<{ ingredients: PantryRowForReview[] }>(REVIEW_QUERY, { kitchenSlug });
      setRows(data.ingredients);
      setError(null);
    } catch (err) {
      setError((err as Error).message || 'Could not load the pantry.');
      setRows([]);
    }
  }, [gql, kitchenSlug]);

  useEffect(() => { load(); }, [load]);

  // One clock per load so every phrase on the page agrees.
  const now = useMemo(() => Date.now(), [rows]);
  const review = useMemo(() => (rows ? reviewPantry(rows, { now }) : null), [rows, now]);
  const byId = useMemo(() => new Map((rows ?? []).map((r) => [r.id, r])), [rows]);

  const grouped = useMemo(() => {
    const g: Record<ReviewSignal, ReviewFinding[]> = { expired: [], expiring: [], stale: [], duplicate: [], outOfStock: [] };
    for (const f of review?.findings ?? []) g[f.signal].push(f);
    return g;
  }, [review]);

  // Rows a checkbox can select: everything except duplicate groups, which
  // have their own Merge control.
  const selectableIds = useMemo(() => {
    const ids: string[] = [];
    for (const s of REVIEW_SIGNALS) if (s !== 'duplicate') for (const f of grouped[s]) ids.push(...f.ids);
    return ids;
  }, [grouped]);

  const toggle = (id: string) =>
    setSelected((prev) => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  const toggleGroup = (signal: ReviewSignal) => {
    const ids = grouped[signal].flatMap((f) => f.ids);
    setSelected((prev) => {
      const next = new Set(prev);
      const all = ids.every((id) => next.has(id));
      for (const id of ids) all ? next.delete(id) : next.add(id);
      return next;
    });
  };

  async function run(label: string, fn: () => Promise<void>, undoable?: { inputs: { id: string; quantity: number | null }[] }) {
    setBusy(true);
    setStatus('');
    try {
      await fn();
      await load();
      setSelected(new Set());
      setConfirmDelete(false);
      setShowExpiry(false);
      setStatus(label);
      setUndo(undoable ? { label, inputs: undoable.inputs } : null);
      headingRef.current?.focus();
    } catch (err) {
      setStatus(`Something went wrong: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const ids = [...selected];
  const n = ids.length;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

  const stillHaveIt = () => run(`Marked ${plural(n, 'item')} as still in stock.`, async () => { await gql(TOUCH, { ids }); });
  const usedUp = () => {
    const previous = ids.map((id) => ({ id, quantity: byId.get(id)?.quantity ?? null }));
    return run(`Set ${plural(n, 'item')} to out of stock.`, async () => {
      await gql(UPDATE_MANY, { inputs: ids.map((id) => ({ id, quantity: 0 })) });
    }, { inputs: previous });
  };
  const setExpiry = () => run(
    expiryValue ? `Set best-by ${expiryValue} on ${plural(n, 'item')}.` : `Cleared the best-by date on ${plural(n, 'item')}.`,
    async () => { await gql(UPDATE_MANY, { inputs: ids.map((id) => ({ id, expiresAt: expiryValue || null })) }); },
  );
  const remove = () => run(`Deleted ${plural(n, 'item')}.`, async () => { await gql(DELETE_MANY, { ids }); });
  const undoLast = () => {
    if (!undo) return;
    const inputs = undo.inputs;
    setUndo(null);
    return run(`Restored ${plural(inputs.length, 'quantity').replace('quantitys', 'quantities')}.`, async () => {
      await gql(UPDATE_MANY, { inputs });
    });
  };
  const merge = (f: ReviewFinding) => {
    const survivorId = survivors[f.ids.join('|')] ?? f.survivorId!;
    const others = f.ids.filter((id) => id !== survivorId);
    const name = byId.get(survivorId)?.name ?? 'the survivor';
    return run(`Merged ${plural(others.length, 'row')} into ${name}.`, async () => {
      setConfirmMerge(null);
      await gql(MERGE, { survivorId, mergeIds: others });
    });
  };

  const total = review?.findings.length ?? 0;

  return (
    <div data-requires-js>
      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
        <div>
          <h1 ref={headingRef} tabIndex={-1} className="text-4xl font-bold outline-none">Pantry Review</h1>
          <p className="text-[var(--color-text-secondary)] mt-2 pretty">
            {rows == null
              ? 'Looking through your pantry…'
              : total === 0
                ? 'Nothing needs attention right now.'
                : `${plural(total, 'thing')} worth a look. Estimates come from each item's category and when it was stocked; stated best-by dates always win.`}
          </p>
        </div>
        {renderLink({ href: pantryHref, className: 'btn-secondary', children: '← Back to pantry' })}
      </div>

      {/* Pre-mounted empty so announcements are heard. */}
      <p role="status" aria-live="polite" className="sr-only">{status}</p>
      {status && (
        <p className="mt-4 mb-2 text-sm flex flex-wrap items-center gap-3" aria-hidden="true">
          <span>{status}</span>
          {undo && (
            <button type="button" onClick={undoLast} disabled={busy} className="underline hover:text-accent">Undo</button>
          )}
        </p>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}

      {rows == null && (
        <div className="space-y-4 mt-8" aria-hidden="true">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-[var(--color-bg-card)] animate-pulse" />)}
        </div>
      )}

      {rows != null && total === 0 && (
        <div className="text-center py-16 text-[var(--color-text-secondary)]">
          <p className="text-lg mb-2">Your pantry looks current.</p>
          <p className="text-sm">Come back after a big shop or a week of cooking.</p>
        </div>
      )}

      <div className={`mt-8 space-y-10 ${n > 0 ? 'pb-32' : ''}`}>
        {REVIEW_SIGNALS.filter((s) => grouped[s].length > 0).map((signal) => {
          const findings = grouped[signal];
          const groupIds = findings.flatMap((f) => f.ids);
          const allSelected = signal !== 'duplicate' && groupIds.every((id) => selected.has(id));
          const someSelected = signal !== 'duplicate' && groupIds.some((id) => selected.has(id));
          return (
            <fieldset key={signal} className="border border-[var(--color-border-card)] p-4 md:p-5">
              <legend className="px-2 text-lg font-bold flex items-center gap-2">
                {REVIEW_SIGNAL_LABELS[signal]}
                <span className="tag tabular-nums">{findings.length}</span>
              </legend>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4 pretty">{SIGNAL_BLURB[signal]}</p>

              {signal !== 'duplicate' && canEdit && (
                <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allSelected}
                    ref={(el) => { if (el) el.indeterminate = !allSelected && someSelected; }}
                    onChange={() => toggleGroup(signal)}
                    className="w-4 h-4 accent-accent"
                  />
                  Select all {findings.length} in this group
                </label>
              )}

              {signal !== 'duplicate' ? (
                <ul role="list" className="divide-y divide-[var(--color-border-card)]">
                  {findings.map((f) => {
                    const row = byId.get(f.ids[0]);
                    if (!row) return null;
                    const checked = selected.has(row.id);
                    return (
                      <li key={row.id} className="py-3">
                        <label className={`flex items-start gap-3 ${canEdit ? 'cursor-pointer' : ''}`}>
                          {canEdit && (
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => toggle(row.id)}
                              aria-describedby={`review-reason-${row.id}`}
                              className="mt-1 w-4 h-4 accent-accent shrink-0"
                            />
                          )}
                          <span className="flex-1 min-w-0">
                            <span className="font-medium">{row.name}</span>
                            {fmtQty(row) && <span className="ml-2 text-sm text-[var(--color-text-secondary)]">{fmtQty(row)}</span>}
                            {row.category && <span className="ml-2 text-xs uppercase tracking-wide text-[var(--color-text-secondary)]">{row.category}</span>}
                            <span id={`review-reason-${row.id}`} className="block text-sm text-[var(--color-text-secondary)] mt-0.5">
                              <Reason f={f} row={row} now={now} />
                            </span>
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <ul role="list" className="space-y-4">
                  {findings.map((f) => {
                    const key = f.ids.join('|');
                    const survivorId = survivors[key] ?? f.survivorId!;
                    const survivor = byId.get(survivorId);
                    const others = f.ids.filter((id) => id !== survivorId).map((id) => byId.get(id)!).filter(Boolean);
                    const plan = survivor ? planMerge(survivor, others) : null;
                    const groupName = `survivor-${key}`;
                    return (
                      <li key={key} className="card p-4">
                        <p id={`dup-reason-${key}`} className="text-sm text-[var(--color-text-secondary)] mb-3">{f.reason}</p>
                        {canEdit ? (
                          <fieldset>
                            <legend className="text-sm font-medium mb-2">Keep which row?</legend>
                            <div role="radiogroup" aria-describedby={`dup-reason-${key}`} className="space-y-1.5">
                              {f.ids.map((id) => {
                                const r = byId.get(id);
                                if (!r) return null;
                                const exp = estimatedExpiry(r);
                                return (
                                  <label key={id} className="flex items-start gap-2 text-sm cursor-pointer">
                                    <input
                                      type="radio"
                                      name={groupName}
                                      value={id}
                                      checked={survivorId === id}
                                      onChange={() => setSurvivors((prev) => ({ ...prev, [key]: id }))}
                                      className="mt-0.5 accent-[var(--color-accent)]"
                                    />
                                    <span>
                                      <span className="font-medium">{r.name}</span>
                                      {fmtQty(r) && <span className="ml-2 text-[var(--color-text-secondary)]">{fmtQty(r)}</span>}
                                      {r.tags && r.tags.length > 0 && <span className="ml-2">{r.tags.map((t) => <span key={t} className="tag mr-1">{t}</span>)}</span>}
                                      {exp && <span className="block text-xs text-[var(--color-text-secondary)]">best by <RelativeTime iso={exp.date} mode="date" />{exp.provenance === 'estimated' ? ' (estimated)' : ''}</span>}
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </fieldset>
                        ) : (
                          <ul className="text-sm space-y-1">
                            {f.ids.map((id) => <li key={id}>{byId.get(id)?.name}{fmtQty(byId.get(id)!) ? ` · ${fmtQty(byId.get(id)!)}` : ''}</li>)}
                          </ul>
                        )}
                        {plan && survivor && (
                          <p className="text-sm mt-3">
                            <span className="text-[var(--color-text-secondary)]">After merging: </span>
                            <span className="font-medium">{survivor.name}</span>
                            {plan.quantity != null && <span>, {Number.isInteger(plan.quantity) ? plan.quantity : Math.round(plan.quantity * 100) / 100}{plan.unit ? ` ${plan.unit}` : ''}</span>}
                            {plan.aliases.length > 0 && <span className="text-[var(--color-text-secondary)]"> · also answers to {plan.aliases.join(', ')}</span>}
                            {plan.unmergedQuantities.length > 0 && (
                              <span className="block text-xs text-[var(--color-warning,var(--color-text-secondary))] mt-1">
                                Can't add the quantity from {plan.unmergedQuantities.join(', ')}: the units don't convert. The survivor's quantity is kept.
                              </span>
                            )}
                          </p>
                        )}
                        {canEdit && (
                          <div className="mt-3 flex items-center gap-2">
                            {confirmMerge === key ? (
                              <>
                                <span className="text-xs text-[var(--color-text-secondary)]">Merge {others.length} into {survivor?.name}?</span>
                                <button type="button" autoFocus onClick={() => merge(f)} disabled={busy} className="btn-primary text-xs px-3 py-1.5">Yes, merge</button>
                                <button type="button" onClick={() => setConfirmMerge(null)} className="btn-secondary text-xs px-3 py-1.5">No</button>
                              </>
                            ) : (
                              <button type="button" onClick={() => setConfirmMerge(key)} disabled={busy} className="btn-secondary text-sm" aria-describedby={`dup-reason-${key}`}>
                                Merge {others.length} into {survivor?.name ?? 'survivor'}
                              </button>
                            )}
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </fieldset>
          );
        })}
      </div>

      {/* One sticky action bar for the whole selection. */}
      {canEdit && n > 0 && (
        <div
          role="region"
          aria-label="Actions for selected items"
          className="fixed bottom-0 inset-x-0 z-20 border-t border-[var(--color-border-card)] bg-body-translucent backdrop-blur px-4 py-3"
        >
          <div className="max-w-4xl mx-auto flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium mr-2 tabular-nums">{plural(n, 'item')} selected</span>
            <button type="button" onClick={stillHaveIt} disabled={busy} className="btn-secondary text-sm">Still have it</button>
            <button type="button" onClick={usedUp} disabled={busy} className="btn-secondary text-sm">Used up</button>
            {showExpiry ? (
              <span className="inline-flex items-center gap-2">
                <label htmlFor="review-expiry" className="sr-only">Best-by date</label>
                <input id="review-expiry" type="date" value={expiryValue} onChange={(e) => setExpiryValue(e.target.value)} className="field-input text-sm" autoFocus />
                <button type="button" onClick={setExpiry} disabled={busy} className="btn-primary text-sm">{expiryValue ? 'Apply' : 'Clear date'}</button>
                <button type="button" onClick={() => setShowExpiry(false)} className="btn-secondary text-sm">Cancel</button>
              </span>
            ) : (
              <button type="button" onClick={() => { setShowExpiry(true); setConfirmDelete(false); }} disabled={busy} className="btn-secondary text-sm">Set best-by…</button>
            )}
            {confirmDelete ? (
              <span className="inline-flex items-center gap-2 ml-auto">
                <span className="text-xs text-[var(--color-text-secondary)]">Delete {plural(n, 'item')}?</span>
                <button type="button" autoFocus onClick={remove} disabled={busy} className="btn-danger text-sm">Yes, delete</button>
                <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary text-sm">No</button>
              </span>
            ) : (
              <button type="button" onClick={() => { setConfirmDelete(true); setShowExpiry(false); }} disabled={busy} className="btn-danger text-sm ml-auto">Delete</button>
            )}
            <button type="button" onClick={() => setSelected(new Set())} disabled={busy} className="text-sm underline hover:text-accent ml-2">Clear selection</button>
          </div>
        </div>
      )}
      {/* Keyboard users can select everything selectable in one go. */}
      {canEdit && selectableIds.length > 0 && n === 0 && (
        <p className="sr-only">Use the checkbox at the top of each group to select every item in it.</p>
      )}
    </div>
  );
}
