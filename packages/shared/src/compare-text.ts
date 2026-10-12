/**
 * Case-insensitive string ordering that doesn't need ICU.
 *
 * Rex's V8 SSR isolate is built without ICU data, so
 * `String.prototype.localeCompare`, `Intl.*` and `toLocale*String` throw
 * `RangeError: Internal error. Icu error.` during a server render, and the
 * whole page becomes "Internal Server Error". Use this for any sort that runs
 * while rendering a server-seeded page; the browser then sorts identically,
 * so hydration matches.
 *
 * Trade-off vs. localeCompare: accented letters sort by code point (after
 * "z") rather than next to their base letter.
 */
export function compareText(a: string, b: string): number {
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  if (x !== y) return x < y ? -1 : 1;
  return a < b ? -1 : a > b ? 1 : 0;
}
