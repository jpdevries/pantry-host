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

import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';
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
  /** Ask before Delete and Merge (the REVIEW_CONFIRM_DESTRUCTIVE setting).
   *  Off by default: the review is built for quick bulk passes. */
  confirmDestructive?: boolean;
  renderLink?: LinkRenderer;
}

/** Freshness signals render as checkbox groups; duplicates render last, after the
 *  end-of-list bar, so merging first shrinks the per-item list. */
const FRESHNESS_SIGNALS: ReviewSignal[] = ['expired', 'expiring', 'stale', 'outOfStock'];

const SIGNAL_BLURB: Record<ReviewSignal, string> = {
  expired: 'Past a stated best-by date, or past the estimate for its category. Still good? Mark it in stock and the estimate restarts from today.',
  expiring: 'Best-by within three days. Worth cooking with first.',
  stale: 'No best-by date and no estimate for its category, and untouched for six months. Still here? Mark it in stock; gone? Mark it out of stock.',
  duplicate: 'Rows that look like the same item. Merging sums quantities, keeps every tag, and makes the other names aliases of the one you keep.',
  outOfStock: 'At zero for two weeks or more and never restocked. This is where Delete belongs; restock from the pantry page instead if it is coming back.',
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

export default function PantryReview({ gql, kitchenSlug, pantryHref, canEdit, confirmDestructive = false, renderLink = defaultLink }: Props) {
  const [rows, setRows] = useState<PantryRowForReview[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeBar, setActiveBar] = useState<'top' | 'bottom'>('top');
  const [showExpiry, setShowExpiry] = useState(false);
  const [expiryValue, setExpiryValue] = useState('');
  const [survivors, setSurvivors] = useState<Record<string, string>>({});
  const [confirmMerge, setConfirmMerge] = useState<string | null>(null);
  const [undo, setUndo] = useState<{ label: string; inputs: { id: string; quantity: number | null; expiresAt?: string | null }[] } | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const barRefs = useRef<Record<'top' | 'bottom', HTMLDivElement | null>>({ top: null, bottom: null });
  const rootRef = useRef<HTMLDivElement>(null);
  // "Is this person navigating by keyboard?" — drives the <kbd> hint fade on
  // touch devices (see .pantry-review kbd in each package's globals.css).
  const [keyboard, setKeyboard] = useState(false);
  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Tab' || e.key.startsWith('Arrow') || e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') setKeyboard(true);
    };
    const onPointer = () => setKeyboard(false);
    window.addEventListener('keydown', onKey);
    window.addEventListener('pointerdown', onPointer);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('pointerdown', onPointer); };
  }, []);

  // The top bar is sticky, so anything the browser scrolls into view (the
  // duplicates jump link, focus moving to a row after an action) would land
  // underneath it. Keep the document's scroll padding equal to the bar's
  // measured height while the bar exists; it changes with wrapping.
  useEffect(() => {
    const bar = barRefs.current.top;
    const root = document.documentElement;
    if (!bar || typeof ResizeObserver === 'undefined') return;
    const apply = () => { root.style.scrollPaddingTop = `${Math.ceil(bar.getBoundingClientRect().height) + 8}px`; };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(bar);
    return () => { ro.disconnect(); root.style.scrollPaddingTop = ''; };
  });

  // (After every useState above: these effects list showExpiry and
  // confirmDelete as dependencies, so they must come after both.)
  // When an inline confirmation or date field closes, its controls unmount
  // and focus would drop to <body>, outside the shortcut scope. Put it back
  // on the button that opened it (a no-op when that button is disabled
  // because the selection was just cleared; run() has focused the heading).
  const deleteBtnRef = useRef<Record<'top' | 'bottom', HTMLButtonElement | null>>({ top: null, bottom: null });
  const expiryBtnRef = useRef<Record<'top' | 'bottom', HTMLButtonElement | null>>({ top: null, bottom: null });
  const prevConfirm = useRef(false);
  const prevExpiry = useRef(false);
  useEffect(() => {
    if (prevConfirm.current && !confirmDelete) deleteBtnRef.current[activeBar]?.focus();
    prevConfirm.current = confirmDelete;
  }, [confirmDelete, activeBar]);
  useEffect(() => {
    if (prevExpiry.current && !showExpiry) expiryBtnRef.current[activeBar]?.focus();
    prevExpiry.current = showExpiry;
  }, [showExpiry, activeBar]);

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

  type UndoInputs = { id: string; quantity: number | null; expiresAt?: string | null }[];

  /**
   * Perform an action over `affected` rows, refetch, and put keyboard focus
   * somewhere sensible. Per the WAI-ARIA Authoring Practices (keyboard
   * interface: when the focused element is removed, move focus to the item
   * that follows it, else the one before it, else a logical container):
   *   1. a row that is back (Undo) → its control;
   *   2. the first row after the last affected one that is still listed;
   *   3. else the nearest row before it;
   *   4. else the control that was pressed, if it is still usable;
   *   5. else the first enabled button of the bar that was used;
   *   6. else the heading.
   * The live region announces the result either way, so nobody is thrown
   * to the top of the page to hear it.
   */
  async function run(label: string, fn: () => Promise<void>, opts: { affected: string[]; undoable?: { inputs: UndoInputs }; restoring?: boolean }) {
    const trigger = document.activeElement as HTMLElement | null;
    const bar = activeBar;
    const rowEls = () => [...(rootRef.current?.querySelectorAll<HTMLElement>('[data-review-row]') ?? [])];
    const orderBefore = [...new Set(rowEls().map((el) => el.dataset.reviewRow!))];
    const affected = new Set(opts.affected);
    setBusy(true);
    setStatus('');
    try {
      await fn();
      await load();
      setSelected(new Set());
      setConfirmDelete(false);
      setConfirmMerge(null);
      setShowExpiry(false);
      setStatus(label);
      setUndo(opts.undoable ? { label, inputs: opts.undoable.inputs } : null);
      requestAnimationFrame(() => {
        // First control per row id, in DOM order (a row can appear in a
        // freshness group and again in a duplicate card).
        const present = new Map<string, HTMLElement>();
        for (const el of rowEls()) if (!present.has(el.dataset.reviewRow!)) present.set(el.dataset.reviewRow!, el);
        if (opts.restoring) {
          const back = [...affected].find((id) => present.has(id));
          if (back) { present.get(back)!.focus(); return; }
        }
        const lastIdx = Math.max(-1, ...orderBefore.map((id, i) => (affected.has(id) ? i : -1)));
        for (let i = lastIdx + 1; i < orderBefore.length; i++) {
          const el = present.get(orderBefore[i]);
          if (el) { el.focus(); return; }
        }
        for (let i = lastIdx - 1; i >= 0; i--) {
          const el = present.get(orderBefore[i]);
          if (el) { el.focus(); return; }
        }
        const usable = (el: HTMLElement | null): el is HTMLElement =>
          !!el && document.contains(el) && !(el as HTMLButtonElement).disabled && el.offsetParent !== null;
        if (usable(trigger)) { trigger.focus(); return; }
        const barButton = [...(barRefs.current[bar]?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find((b) => !b.disabled) ?? null;
        if (usable(barButton)) { barButton.focus(); return; }
        headingRef.current?.focus();
      });
    } catch (err) {
      setStatus(`Something went wrong: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  }

  const ids = [...selected];
  const n = ids.length;
  const plural = (count: number, word: string) => `${count} ${word}${count === 1 ? '' : 's'}`;

  const markInStock = () => run(`Marked ${plural(n, 'item')} in stock.`, async () => { await gql(TOUCH, { ids }); }, { affected: ids });
  // Out of stock is the metadata-preserving "delete": quantity 0 keeps
  // tags, aliases, barcode data and history. The stated best-by belonged to
  // the carton just finished, so it is cleared too; restocking restarts the
  // estimate. Undo restores both.
  const markOutOfStock = () => {
    const previous = ids.map((id) => ({ id, quantity: byId.get(id)?.quantity ?? null, expiresAt: byId.get(id)?.expiresAt ?? null }));
    return run(`Marked ${plural(n, 'item')} out of stock.`, async () => {
      await gql(UPDATE_MANY, { inputs: ids.map((id) => ({ id, quantity: 0, expiresAt: null })) });
    }, { affected: ids, undoable: { inputs: previous } });
  };
  const setExpiry = () => run(
    expiryValue ? `Set best-by ${expiryValue} on ${plural(n, 'item')}.` : `Cleared the best-by date on ${plural(n, 'item')}.`,
    async () => { await gql(UPDATE_MANY, { inputs: ids.map((id) => ({ id, expiresAt: expiryValue || null })) }); },
    { affected: ids },
  );
  const remove = () => run(`Deleted ${plural(n, 'item')}.`, async () => { await gql(DELETE_MANY, { ids }); }, { affected: ids });
  const undoLast = () => {
    if (!undo) return;
    const inputs = undo.inputs;
    setUndo(null);
    return run(`Restored ${plural(inputs.length, 'quantity').replace('quantitys', 'quantities')}.`, async () => {
      await gql(UPDATE_MANY, { inputs });
    }, { affected: inputs.map((i) => i.id), restoring: true });
  };
  const merge = (f: ReviewFinding) => {
    const survivorId = survivors[f.ids.join('|')] ?? f.survivorId!;
    const others = f.ids.filter((id) => id !== survivorId);
    const name = byId.get(survivorId)?.name ?? 'the survivor';
    return run(`Merged ${plural(others.length, 'row')} into ${name}.`, async () => {
      await gql(MERGE, { survivorId, mergeIds: others });
    }, { affected: f.ids });
  };

  const total = review?.findings.length ?? 0;

  const toggleAll = () =>
    setSelected((prev) => (prev.size === selectableIds.length ? new Set() : new Set(selectableIds)));

  // Single-key shortcuts. Bound on the component root, so they only fire
  // while focus is inside the review (WCAG 2.1.4: character-key shortcuts
  // must be scoped to a focused component or remappable). Text fields and
  // modifier combos pass through untouched.
  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    if (!canEdit || busy) return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement;
    const tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable) return;
    if (tag === 'INPUT' && (t as HTMLInputElement).type !== 'checkbox' && (t as HTMLInputElement).type !== 'radio') return;
    const key = e.key.toLowerCase();
    if (key === 'escape') {
      if (confirmDelete || showExpiry) { setConfirmDelete(false); setShowExpiry(false); }
      else if (n > 0) setSelected(new Set());
      else return;
      e.preventDefault();
      return;
    }
    if (selectableIds.length === 0) return;
    switch (key) {
      case 'a': toggleAll(); break;
      case 'i': if (n > 0) markInStock(); break;
      case 'o': if (n > 0) markOutOfStock(); break;
      case 'b': if (n > 0) { setActiveBar('top'); setShowExpiry(true); setConfirmDelete(false); } break;
      case 'd': if (n > 0) { if (confirmDestructive) { setActiveBar('top'); setConfirmDelete(true); setShowExpiry(false); } else remove(); } break;
      default: return;
    }
    e.preventDefault();
  }

  const showBars = canEdit && total > 0 && selectableIds.length > 0;
  const kbd = (k: string) => <kbd className="ml-1 text-xs font-normal">{k}</kbd>;

  /** The action buttons, shared by the top (sticky) and bottom (end of
   *  list) bars. The selection count is a live region in the top bar only,
   *  so it is announced once; the inline best-by field and delete
   *  confirmation open in whichever bar asked for them. */
  function renderActions(pos: 'top' | 'bottom') {
    const mine = activeBar === pos;
    const open = (what: 'expiry' | 'delete') => {
      setActiveBar(pos);
      setShowExpiry(what === 'expiry');
      setConfirmDelete(what === 'delete');
    };
    return (
      <div>
        <p className="text-sm font-medium tabular-nums mb-2" aria-live={pos === 'top' ? 'polite' : undefined} aria-atomic={pos === 'top' ? true : undefined}>
          {plural(n, 'item')} selected
        </p>
        <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggleAll} disabled={busy} aria-keyshortcuts="a" className="btn-secondary text-sm">
          {n === selectableIds.length ? 'Select none' : 'Select all'}{kbd('A')}
        </button>
        <button type="button" onClick={markInStock} disabled={busy || n === 0} aria-keyshortcuts="i" className="btn-secondary text-sm">
          Mark in stock{kbd('I')}
        </button>
        <button type="button" onClick={markOutOfStock} disabled={busy || n === 0} aria-keyshortcuts="o" className="btn-secondary text-sm">
          Mark out of stock{kbd('O')}
        </button>
        {showExpiry && mine ? (
          <span className="inline-flex items-center gap-2">
            <label htmlFor={`review-expiry-${pos}`} className="sr-only">Best-by date</label>
            <input id={`review-expiry-${pos}`} type="date" value={expiryValue} onChange={(e) => setExpiryValue(e.target.value)} className="field-input text-sm" autoFocus />
            <button type="button" onClick={setExpiry} disabled={busy} className="btn-primary text-sm">{expiryValue ? 'Apply' : 'Clear date'}</button>
            <button type="button" onClick={() => setShowExpiry(false)} className="btn-secondary text-sm">Cancel</button>
          </span>
        ) : (
          <button type="button" ref={(el) => { expiryBtnRef.current[pos] = el; }} onClick={() => open('expiry')} disabled={busy || n === 0} aria-keyshortcuts="b" className="btn-secondary text-sm">
            Set best-by date{kbd('B')}
          </button>
        )}
        {confirmDelete && mine ? (
          <span className="inline-flex flex-wrap items-center gap-2 ml-auto" role="group" aria-label="Confirm delete">
            <span className="text-xs text-[var(--color-text-secondary)]">
              Delete {plural(n, 'item')}? That drops their tags, aliases and barcode data. Out of stock keeps them.
            </span>
            <button type="button" autoFocus onClick={markOutOfStock} disabled={busy} className="btn-primary text-sm">Mark out of stock instead</button>
            <button type="button" onClick={remove} disabled={busy} className="btn-danger text-sm">Yes, delete</button>
            <button type="button" onClick={() => setConfirmDelete(false)} className="btn-secondary text-sm">No</button>
          </span>
        ) : (
          <button type="button" ref={(el) => { deleteBtnRef.current[pos] = el; }} onClick={() => (confirmDestructive ? open('delete') : remove())} disabled={busy || n === 0} aria-keyshortcuts="d" className="btn-danger text-sm ml-auto">
            Delete{kbd('D')}
          </button>
        )}
        </div>
      </div>
    );
  }

  const renderGroup = (signal: ReviewSignal) => {
          const findings = grouped[signal];
          const groupIds = findings.flatMap((f) => f.ids);
          const allSelected = signal !== 'duplicate' && groupIds.every((id) => selected.has(id));
          const someSelected = signal !== 'duplicate' && groupIds.some((id) => selected.has(id));
          return (
            <fieldset
              key={signal}
              id={signal === 'duplicate' ? 'review-duplicates' : undefined}
              tabIndex={signal === 'duplicate' ? -1 : undefined}
              className="border border-[var(--color-border-card)] p-4 md:p-5 outline-none"
            >
              <legend className="px-2 text-lg font-bold flex items-center gap-2">
                {REVIEW_SIGNAL_LABELS[signal]}
                <span className="tag tabular-nums ml-2">{findings.length}</span>
              </legend>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4 pretty">
                {SIGNAL_BLURB[signal]}
                {signal === 'duplicate' && showBars && (
                  <> <a href="#review-actions" onClick={(e) => { e.preventDefault(); barRefs.current.top?.querySelector<HTMLElement>('button')?.focus(); barRefs.current.top?.scrollIntoView({ block: 'start' }); }} className="underline hover:text-accent">Back to the action bar</a></>
                )}
              </p>

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
                              data-review-row={row.id}
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
                                      data-review-row={id}
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
                              <button type="button" onClick={() => (confirmDestructive ? setConfirmMerge(key) : merge(f))} disabled={busy} className="btn-secondary text-sm" aria-describedby={`dup-reason-${key}`}>
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
  };

  return (
    <div ref={rootRef} className="pantry-review" data-requires-js data-keyboard={keyboard ? 'true' : undefined} onKeyDown={onKeyDown}>
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
            <button type="button" onClick={undoLast} disabled={busy} className="ml-3 underline hover:text-accent">Undo</button>
          )}
        </p>
      )}
      {error && <p role="alert" className="mt-4 text-sm text-red-500">{error}</p>}

      {/* The action bar comes first in DOM order and sticks to the top, so a
          keyboard user reaches the actions before the rows instead of after
          all of them. The same actions repeat after the last group for
          anyone who has read to the end. Single-key shortcuts (below) work
          while focus is anywhere inside this review, per WCAG 2.1.4. */}
      {showBars && (
        <div
          ref={(el) => { barRefs.current.top = el; }}
          id="review-actions"
          role="region"
          aria-label="Actions for selected items"
          className="sticky top-0 z-20 -mx-4 px-4 md:-mx-8 md:px-8 py-3 mt-6 border-b border-[var(--color-border-card)] bg-body-translucent backdrop-blur"
        >
          {renderActions('top')}
          <p className="mt-2 text-xs text-[var(--color-text-secondary)]">
            Keyboard: with focus in this review, <kbd>A</kbd> selects all or none, <kbd>I</kbd> marks in stock, <kbd>O</kbd> marks out of stock, <kbd>B</kbd> sets a best-by date, <kbd>D</kbd> deletes{confirmDestructive ? ' after a confirmation that offers Mark out of stock instead' : ''}, <kbd>Esc</kbd> {confirmDestructive ? 'closes a confirmation or ' : ''}clears the selection. Each group also has its own select-all checkbox.
          </p>
        </div>
      )}

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

      {/* Duplicates live at the very end (after the end-of-list bar), so
          this points keyboard users there first: every merge removes a row
          from the per-item groups above it. */}
      {grouped.duplicate.length > 0 && (
        <aside aria-label="Likely duplicates" className="mt-6 mb-8 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm border-l-4 border-[var(--color-accent)] pl-3 py-1">
          <span>
            <span className="font-medium">{plural(grouped.duplicate.length, 'likely duplicate group')}</span>
            {canEdit ? ' near the end of the page. Merging first shrinks the list below.' : ' near the end of the page.'}
          </span>
          <a
            href="#review-duplicates"
            onClick={(e) => { e.preventDefault(); const el = document.getElementById('review-duplicates'); el?.scrollIntoView({ block: 'start' }); el?.focus(); }}
            className="underline hover:text-accent"
          >
            Jump to duplicates
          </a>
        </aside>
      )}

      <div className="mt-8 space-y-10">
        {FRESHNESS_SIGNALS.filter((s) => grouped[s].length > 0).map(renderGroup)}
      </div>

      {/* End-of-list bar: the same actions for anyone who read all the way
          down, so they don't have to travel back up. Static, not sticky. */}
      {showBars && (
        <div
          ref={(el) => { barRefs.current.bottom = el; }}
          role="region"
          aria-label="Actions for selected items (end of list)"
          className="mt-10 pt-4 border-t border-[var(--color-border-card)]"
        >
          {renderActions('bottom')}
        </div>
      )}

      {grouped.duplicate.length > 0 && <div className="mt-10">{renderGroup('duplicate')}</div>}
    </div>
  );
}
