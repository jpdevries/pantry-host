/**
 * Shared wrapper for the results grid on each Recipe Import tab.
 *
 * While `importing` is true:
 *  - Sets the native `inert` attribute on the inner grid so all of its
 *    interactive children are removed from the tab order, can't be
 *    clicked, and can't receive focus.
 *  - Dims the grid and overlays a centered spinner.
 *  - Sets `aria-busy="true"` so screen readers announce the change.
 *
 * Focus restoration on cancel/error is the caller's responsibility — this
 * component doesn't know whether the import succeeded (in which case the
 * page navigates away) or failed (in which case we should put the cursor
 * back where it was). The recommended idiom inside each handleImport is:
 *
 *   const prevFocus = document.activeElement as HTMLElement | null;
 *   setImporting(true);
 *   try { ... } finally {
 *     setImporting(false);
 *     requestAnimationFrame(() => prevFocus?.focus?.());
 *   }
 *
 * Browsers automatically blur the active element when inert is applied,
 * so the rAF + manual .focus() restores it on the next paint.
 */
import { CircleNotch } from '@phosphor-icons/react';

/**
 * Snapshot the currently focused element so we can restore it after the
 * import resolves. Call once at the top of handleImport, before flipping
 * `importing` to true.
 */
export function captureActiveElement(): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  return (document.activeElement as HTMLElement | null) ?? null;
}

/**
 * Restore focus to a previously captured element on the next paint.
 * Used in handleImport's failure path so the user lands back on the
 * button (or per-card focus) they were on. Safe if the element was
 * unmounted in the meantime — a try/catch swallows the error.
 */
export function restoreFocus(el: HTMLElement | null): void {
  if (!el) return;
  requestAnimationFrame(() => {
    try {
      el.focus();
    } catch {
      /* element unmounted while inert was applied — fine */
    }
  });
}

interface Props {
  importing: boolean;
  /** Optional progress copy shown beneath the spinner. */
  importingLabel?: string;
  className?: string;
  onKeyDown?: React.KeyboardEventHandler<HTMLDivElement>;
  /** Same value the caller used to pass directly to the grid div. */
  ariaKeyshortcuts?: string;
  children: React.ReactNode;
}

export default function ImportGrid({
  importing,
  importingLabel,
  className,
  onKeyDown,
  ariaKeyshortcuts,
  children,
}: Props) {
  // React 19 supports `inert` as a normal boolean prop. For older
  // type defs we cast through unknown.
  const inertProps = importing ? ({ inert: '' } as unknown as Record<string, string>) : {};
  return (
    <div className="relative">
      <div
        className={`${className ?? ''} ${importing ? 'opacity-40 pointer-events-none transition-opacity' : 'transition-opacity'}`}
        onKeyDown={onKeyDown}
        aria-keyshortcuts={ariaKeyshortcuts}
        aria-busy={importing || undefined}
        {...inertProps}
      >
        {children}
      </div>
      {importing && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          aria-hidden="true"
        >
          <div className="flex flex-col items-center gap-3 px-6 py-4 rounded-xl bg-[var(--color-bg-card)] shadow-lg border border-[var(--color-border-card)]">
            <CircleNotch size={28} className="animate-spin text-[var(--color-accent)]" />
            {importingLabel && (
              <p className="text-sm text-[var(--color-text-secondary)]">{importingLabel}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
