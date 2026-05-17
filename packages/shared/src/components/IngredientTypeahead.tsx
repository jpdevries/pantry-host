/**
 * Typeahead combobox used for the pantry IngredientForm name and category
 * fields. Two modes:
 *
 *  - `segmented` (default): value is a comma-separated string; suggestions
 *    operate on the segment after the last comma so aliases still get
 *    autocomplete. Used by the Name field.
 *
 *  - `single`: value is a single picked string; selection replaces the
 *    whole value. Optional `groups` render as labeled sections when the
 *    input is empty (mimics a <select> with <optgroup>). Used by Category.
 *
 * Background/border/shadow use inline styles instead of
 * `bg-[var(--color-bg-card)]` etc. — Rex's Tailwind v4 can't reliably
 * generate arbitrary-value utilities from shared-package sources, so
 * var-based bg classes render transparent. Same workaround shipped in
 * globals.css (`.bg-body`, `.ing-qty`, etc.).
 */

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { COMMON_INGREDIENTS } from '../constants';
import { usePreferBrowserChrome } from './prefer-browser-chrome';

type Mode = 'segmented' | 'single';

interface Group {
  label: string;
  items: readonly string[];
}

interface Props {
  id: string;
  value: string;
  onChange: (next: string) => void;
  mode?: Mode;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  suggestions?: readonly string[];
  /** Grouped suggestions for `single` mode — shown when the input is empty. */
  groups?: readonly Group[];
  /** Max results shown in the filtered (non-grouped) list. */
  maxResults?: number;
  'aria-describedby'?: string;
  'aria-required'?: boolean | 'true' | 'false';
  // ── iOS keyboard hints ────────────────────────────────────────────────
  // Pass-throughs that materially change the iOS soft keyboard. None of
  // these affect the custom dropdown UI; they only style the keyboard.
  /** `'search'` shows a search-flavored iOS keyboard with a "Go"/"Search"
   *  return key; useful on filter inputs. Default unset (`'text'`). */
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  /** Labels the iOS return key. `'search'` for filter inputs, `'done'` for
   *  add-form fields, etc. Default unset (browser default "return"). */
  enterKeyHint?: React.HTMLAttributes<HTMLInputElement>['enterKeyHint'];
  /** Defaults to `'off'` in segmented mode (tag-list inputs are typically
   *  lowercase and shouldn't get sentence-cap'd by iOS); pass-through with
   *  no default in single mode. */
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  /** iOS auto-correct routinely mangles ingredient / tag names. Defaults
   *  to `'off'` in segmented mode; pass-through with no default in single. */
  autoCorrect?: 'on' | 'off';
  /** Same rationale as autoCorrect — defaults to `false` in segmented mode. */
  spellCheck?: boolean;
  // ── A11y polish ───────────────────────────────────────────────────────
  /** Override the listbox `aria-label`. Default `'Suggestions'` is generic
   *  for SR users hearing it on every typeahead in the page; pass something
   *  more specific (e.g. `'Tag suggestions'`, `'Cookware suggestions'`). */
  ariaLabel?: string;
  /** When `true` and `mode === 'single'`, sets `aria-invalid` on the input
   *  while the value is non-empty and not an exact match in `suggestions` /
   *  `groups`. Lets parents enforce list-only semantics for fields like
   *  Category that should reject free-text on submit. */
  listOnly?: boolean;
}

const DEFAULT_MAX_RESULTS = 8;

function splitSegments(value: string): { head: string[]; tail: string } {
  const parts = value.split(',');
  const tail = parts[parts.length - 1] ?? '';
  return { head: parts.slice(0, -1).map((s) => s.trim()), tail };
}

function rankMatches(
  query: string,
  pool: readonly string[],
  exclude: Set<string>,
  max: number,
): string[] {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  const prefix: string[] = [];
  const contains: string[] = [];
  for (const item of pool) {
    const lower = item.toLowerCase();
    if (exclude.has(lower)) continue;
    if (lower === q) continue;
    if (lower.startsWith(q)) prefix.push(item);
    else if (lower.includes(q)) contains.push(item);
    if (prefix.length >= max) break;
  }
  return [...prefix, ...contains].slice(0, max);
}

function highlight(label: string, query: string): ReactNode {
  const q = query.trim();
  if (!q) return label;
  const idx = label.toLowerCase().indexOf(q.toLowerCase());
  if (idx < 0) return label;
  // Wrapping in a single <span> keeps the row's flex container from
  // turning each text run into an anonymous flex item — those strip
  // their edge whitespace, eating the space between e.g. "Jacobsen"
  // and a mid-string match like "Rose" in "Jacobsen Rosemary Salt".
  return (
    <span>
      {label.slice(0, idx)}
      <mark style={{ background: 'transparent', fontWeight: 600, color: 'var(--color-text-primary)' }}>
        {label.slice(idx, idx + q.length)}
      </mark>
      {label.slice(idx + q.length)}
    </span>
  );
}

const listboxStyle: React.CSSProperties = {
  position: 'absolute',
  zIndex: 20,
  marginTop: 4,
  width: '100%',
  maxHeight: '16rem',
  overflowY: 'auto',
  background: 'var(--color-bg-card)',
  border: '1px solid var(--color-border-card)',
  borderRadius: '0.5rem',
  // Black is the right shadow color in dark mode (where the dropdown sits on a
  // mostly-dark canvas) but reads as a heavy slab in light mode. light-dark()
  // matches the rest of the theme tokens (--color-season-*, --color-diet-*) —
  // the body's color-scheme is set by the shared theme module on every render.
  boxShadow:
    '0 10px 15px -3px light-dark(rgba(0,0,0,0.10), rgba(0,0,0,0.35)),' +
    ' 0 4px 6px -4px light-dark(rgba(0,0,0,0.06), rgba(0,0,0,0.30))',
  padding: '0.25rem 0',
};

const optionBaseStyle: React.CSSProperties = {
  // 44px min height matches Apple HIG / Material's touch-target guidance
  // (also future-proofs us against WCAG 2.2 SC 2.5.8 AA). Flex + center
  // keeps the highlighted-match weight change from shifting the row height.
  minHeight: '2.75rem',
  display: 'flex',
  alignItems: 'center',
  padding: '0.5rem 0.75rem',
  fontSize: '0.875rem',
  cursor: 'pointer',
  color: 'var(--color-text-secondary)',
};

const optionActiveStyle: React.CSSProperties = {
  background: 'var(--color-bg-body)',
  color: 'var(--color-text-primary)',
  // Weight bump alongside the bg/fg color shift so the active state is
  // perceivable without color (WCAG 1.4.1 multi-channel cue).
  fontWeight: 500,
};

// When the input doesn't have room to drop the listbox below within the
// visualViewport (soft-keyboard up on small screens, mostly), we flip it
// upward. Spread on top of listboxStyle when applicable.
const listboxDropUpStyle: React.CSSProperties = {
  top: 'auto',
  bottom: '100%',
  marginTop: 0,
  marginBottom: 4,
};

const groupHeaderStyle: React.CSSProperties = {
  padding: '0.25rem 0.75rem',
  fontSize: '0.6875rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--color-text-secondary)',
  opacity: 0.75,
};

export default function IngredientTypeahead({
  id,
  value,
  onChange,
  mode = 'segmented',
  required,
  autoFocus,
  placeholder,
  suggestions = COMMON_INGREDIENTS,
  groups,
  maxResults = DEFAULT_MAX_RESULTS,
  'aria-describedby': ariaDescribedBy,
  'aria-required': ariaRequired,
  inputMode,
  enterKeyHint,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  ariaLabel = 'Suggestions',
  listOnly,
}: Props) {
  const preferNative = usePreferBrowserChrome();
  // Mode-based iOS keyboard defaults — segmented (tag-list) inputs almost
  // always benefit from no auto-cap / auto-correct. Single mode keeps
  // browser defaults so name-style fields (e.g. recipe titles) still get
  // sensible capitalization.
  const isSegmented = mode === 'segmented';
  const resolvedAutoCapitalize = autoCapitalize ?? (isSegmented ? 'off' : undefined);
  const resolvedAutoCorrect = autoCorrect ?? (isSegmented ? 'off' : undefined);
  const resolvedSpellCheck = spellCheck ?? (isSegmented ? false : undefined);
  const listboxId = useId();
  const liveRegionId = useId();
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [dropUp, setDropUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const { head, tail } = useMemo(
    () => (mode === 'segmented' ? splitSegments(value) : { head: [] as string[], tail: value }),
    [value, mode],
  );
  const excluded = useMemo(
    () => new Set(head.map((s) => s.toLowerCase()).filter(Boolean)),
    [head],
  );
  const filtered = useMemo(
    () => rankMatches(tail, suggestions, excluded, maxResults),
    [tail, suggestions, excluded, maxResults],
  );

  // In single mode, show all grouped options when the input is empty.
  const showGroups = mode === 'single' && !tail.trim() && groups && groups.length > 0;

  // Flat ordered list used for keyboard navigation.
  const navList = useMemo<string[]>(() => {
    if (showGroups) return groups!.flatMap((g) => g.items as string[]);
    return filtered;
  }, [showGroups, groups, filtered]);

  useEffect(() => {
    setActiveIdx((prev) => (navList.length === 0 ? -1 : Math.min(prev, navList.length - 1)));
  }, [navList]);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  // Keep the keyboard-active option in view. Without this, ArrowDown/End/Home
  // (or just navigating past the listbox's `maxHeight: 16rem`) leaves the
  // active option scrolled off-screen — the user navigates to a row they
  // can't see. `block: 'nearest'` is a no-op when the row is already visible.
  useEffect(() => {
    if (!open || activeIdx < 0) return;
    const el = document.getElementById(`${listboxId}-opt-${activeIdx}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx, open, listboxId]);

  // Flip the dropdown upward when there's not enough room below the input
  // (soft keyboard up on mobile, or input near the bottom of the page).
  // Recomputed on each open + on viewport resize.
  useEffect(() => {
    if (!open || !inputRef.current || typeof window === 'undefined') return;
    function recompute() {
      const rect = inputRef.current?.getBoundingClientRect();
      if (!rect) return;
      const vp = window.visualViewport;
      const viewportH = vp?.height ?? window.innerHeight;
      const dropdownH = 256; // matches listboxStyle.maxHeight (16rem)
      const spaceBelow = viewportH - rect.bottom;
      // Flip only when below is insufficient AND above has more room.
      setDropUp(spaceBelow < dropdownH && rect.top > spaceBelow);
    }
    recompute();
    window.visualViewport?.addEventListener('resize', recompute);
    window.addEventListener('resize', recompute);
    return () => {
      window.visualViewport?.removeEventListener('resize', recompute);
      window.removeEventListener('resize', recompute);
    };
  }, [open]);

  function applySelection(choice: string) {
    if (mode === 'single') {
      onChange(choice);
      setOpen(false);
      setActiveIdx(-1);
      requestAnimationFrame(() => inputRef.current?.focus());
      return;
    }
    const parts = value.split(',');
    parts[parts.length - 1] = (parts.length > 1 ? ' ' : '') + choice;
    onChange(parts.join(','));
    setOpen(false);
    setActiveIdx(-1);
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open && navList.length > 0) setOpen(true);
      if (navList.length === 0) return;
      setActiveIdx((prev) => (prev + 1) % navList.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (navList.length === 0) return;
      setActiveIdx((prev) => (prev <= 0 ? navList.length - 1 : prev - 1));
    } else if (e.key === 'Home') {
      // ARIA APG combobox pattern: Home jumps to first option when open.
      if (open && navList.length > 0) {
        e.preventDefault();
        setActiveIdx(0);
      }
    } else if (e.key === 'End') {
      // ARIA APG combobox pattern: End jumps to last option when open.
      if (open && navList.length > 0) {
        e.preventDefault();
        setActiveIdx(navList.length - 1);
      }
    } else if (e.key === 'Enter') {
      if (open && activeIdx >= 0 && navList[activeIdx]) {
        e.preventDefault();
        applySelection(navList[activeIdx]);
      }
    } else if (e.key === 'Escape') {
      if (open) {
        e.preventDefault();
        e.stopPropagation();
        setOpen(false);
      }
    } else if (e.key === 'Tab') {
      if (open && activeIdx >= 0 && navList[activeIdx]) {
        applySelection(navList[activeIdx]);
      } else {
        setOpen(false);
      }
    }
  }

  const showList = open && navList.length > 0;
  const activeOptionId = showList && activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined;

  // Native fallback for the PREFER_BROWSER_CHROME setting. Branched after
  // all hooks have run so toggling the setting at runtime doesn't break
  // the Rules of Hooks.
  // List-only validation (single mode + `listOnly={true}`). aria-invalid
  // signals to AT users that the typed value isn't one of the suggestions;
  // parents enforce on submit (current behavior is otherwise free-text).
  const isExactMatch =
    !value ||
    suggestions.some((s) => s.toLowerCase() === value.toLowerCase()) ||
    (groups?.some((g) => g.items.some((i) => i.toLowerCase() === value.toLowerCase())) ?? false);
  const ariaInvalid = listOnly && mode === 'single' && !isExactMatch ? true : undefined;

  if (preferNative) {
    return (
      <NativeFallback
        id={id}
        value={value}
        onChange={onChange}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        suggestions={suggestions}
        groups={groups}
        ariaDescribedBy={ariaDescribedBy}
        ariaRequired={ariaRequired}
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        autoCapitalize={resolvedAutoCapitalize}
        autoCorrect={resolvedAutoCorrect}
        spellCheck={resolvedSpellCheck}
        listOnly={listOnly}
      />
    );
  }

  function renderOption(item: string, flatIdx: number) {
    const active = flatIdx === activeIdx;
    return (
      <li
        key={`${flatIdx}-${item}`}
        id={`${listboxId}-opt-${flatIdx}`}
        role="option"
        aria-selected={active}
        onMouseEnter={() => setActiveIdx(flatIdx)}
        onClick={() => applySelection(item)}
        style={{ ...optionBaseStyle, ...(active ? optionActiveStyle : null) }}
      >
        {highlight(item, tail)}
      </li>
    );
  }

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      <input
        ref={inputRef}
        id={id}
        type="text"
        role="combobox"
        required={required}
        value={value}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        autoCapitalize={resolvedAutoCapitalize}
        autoCorrect={resolvedAutoCorrect}
        spellCheck={resolvedSpellCheck}
        className="field-input w-full"
        aria-autocomplete="list"
        aria-expanded={showList}
        aria-controls={listboxId}
        aria-activedescendant={activeOptionId}
        aria-describedby={ariaDescribedBy ? `${ariaDescribedBy} ${liveRegionId}` : liveRegionId}
        aria-required={ariaRequired}
        aria-invalid={ariaInvalid}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (mode === 'single') setOpen(true);
          else if (tail.trim()) setOpen(true);
        }}
        onKeyDown={handleKeyDown}
      />
      {/* Polite live region announces match counts as the user types. SR
          users hear "8 suggestions available" when results change. The
          input's aria-describedby points here so the announcement is also
          attributed to the field on first focus. */}
      <div id={liveRegionId} role="status" aria-live="polite" aria-atomic="true" className="sr-only">
        {showList ? `${navList.length} suggestion${navList.length === 1 ? '' : 's'} available` : ''}
      </div>
      {showList && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          onPointerDown={(e) => e.preventDefault()}
          style={dropUp ? { ...listboxStyle, ...listboxDropUpStyle } : listboxStyle}
        >
          {showGroups
            ? (() => {
                let flatIdx = 0;
                return groups!.map((g) => (
                  <li key={g.label} role="presentation">
                    <div style={groupHeaderStyle}>{g.label}</div>
                    <ul role="group" aria-label={g.label} style={{ padding: 0, margin: 0, listStyle: 'none' }}>
                      {g.items.map((item) => renderOption(item, flatIdx++))}
                    </ul>
                  </li>
                ));
              })()
            : filtered.map((m, i) => renderOption(m, i))}
        </ul>
      )}
    </div>
  );
}

// ── Native fallback ──────────────────────────────────────────────────────
// When PREFER_BROWSER_CHROME is on, render the same shape this component
// replaced — a plain <input list> + <datalist> for segmented mode, or a
// <select> with <optgroup>s for single mode. UX-identical to pre-PR
// behavior; lets mobile users get the native iOS / Android picker.

interface NativeFallbackProps {
  id: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  placeholder?: string;
  suggestions: readonly string[];
  groups?: readonly Group[];
  ariaDescribedBy?: string;
  ariaRequired?: boolean | 'true' | 'false';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  enterKeyHint?: React.HTMLAttributes<HTMLInputElement>['enterKeyHint'];
  autoCapitalize?: 'off' | 'none' | 'on' | 'sentences' | 'words' | 'characters';
  autoCorrect?: 'on' | 'off';
  spellCheck?: boolean;
  /** When true, render as `<select>` (enforces picking from `suggestions` /
   *  `groups`). Otherwise render as `<input list>` + `<datalist>` (free-text
   *  with suggestions). The custom-path `mode` is irrelevant here — it only
   *  governs how *picking a suggestion* updates the value (replace vs append),
   *  which has no native equivalent worth differentiating. */
  listOnly?: boolean;
}

function NativeFallback({
  id,
  value,
  onChange,
  required,
  autoFocus,
  placeholder,
  suggestions,
  groups,
  ariaDescribedBy,
  ariaRequired,
  inputMode,
  enterKeyHint,
  autoCapitalize,
  autoCorrect,
  spellCheck,
  listOnly,
}: NativeFallbackProps) {
  const datalistId = useId();
  if (listOnly) {
    return (
      <select
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        className="field-select w-full"
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
      >
        <option value="">{placeholder ?? '— select —'}</option>
        {groups && groups.length > 0
          ? groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.items.map((item) => (
                  <option key={item} value={item}>{item}</option>
                ))}
              </optgroup>
            ))
          : suggestions.map((item) => (
              <option key={item} value={item}>{item}</option>
            ))}
      </select>
    );
  }
  return (
    <>
      <input
        id={id}
        type="text"
        list={datalistId}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        autoFocus={autoFocus}
        placeholder={placeholder}
        autoComplete="off"
        inputMode={inputMode}
        enterKeyHint={enterKeyHint}
        autoCapitalize={autoCapitalize}
        autoCorrect={autoCorrect}
        spellCheck={spellCheck}
        className="field-input w-full"
        aria-describedby={ariaDescribedBy}
        aria-required={ariaRequired}
      />
      <datalist id={datalistId}>
        {suggestions.map((s) => <option key={s} value={s} />)}
      </datalist>
    </>
  );
}
