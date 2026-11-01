/**
 * Date text without `Intl`.
 *
 * Rex's server render has no ICU data (CLAUDE.md gotcha 16), so anything
 * that can render on the server formats dates by hand. These helpers back
 * the `<RelativeTime>` component: a relative phrase for people, with the
 * ISO value kept for the `datetime` attribute and the absolute date for the
 * tooltip. Day arithmetic is done on UTC calendar days so "yesterday" means
 * the previous calendar day, not "more than 24 hours ago".
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  // A bare date ("2026-11-10") parses as UTC midnight, which is what we want
  // for best-by dates; a full timestamp parses as itself.
  const t = new Date(iso).getTime();
  return Number.isFinite(t) ? t : null;
}

function utcDay(ms: number): number {
  return Math.floor(ms / DAY_MS);
}

/** Whole calendar days from `now` to `iso`: negative in the past. */
export function daysUntil(iso: string, now: number = Date.now()): number | null {
  const t = parseIso(iso);
  if (t == null) return null;
  return utcDay(t) - utcDay(now);
}

/** "today", "yesterday", "3 days ago", "tomorrow", "in 3 days", or null. */
export function relativeDays(iso: string, now: number = Date.now()): string | null {
  const d = daysUntil(iso, now);
  if (d == null) return null;
  if (d === 0) return 'today';
  if (d === -1) return 'yesterday';
  if (d === 1) return 'tomorrow';
  if (d < 0) return `${-d} days ago`;
  return `in ${d} days`;
}

/** "8 Nov 2026" (UTC calendar date), or the input when it won't parse. */
export function formatDate(iso: string): string {
  const t = parseIso(iso);
  if (t == null) return iso;
  const d = new Date(t);
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}

/** "2026-11-08": the value for a date-only `datetime` attribute. */
export function isoDate(iso: string): string {
  const t = parseIso(iso);
  if (t == null) return iso;
  return new Date(t).toISOString().slice(0, 10);
}

/** "P14D": an ISO 8601 duration for a `<time datetime>`. */
export function isoDays(days: number): string {
  return `P${Math.round(days)}D`;
}

export function pluralDays(n: number): string {
  return n === 1 ? '1 day' : `${n} days`;
}
