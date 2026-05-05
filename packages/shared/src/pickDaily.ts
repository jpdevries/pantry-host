/** Pick a stable element from `items` using the calendar date as seed.
 *  Returns the same value all day on both server and client — safe for
 *  SSR-hydrated placeholders and other render-time picks that should
 *  feel rotating but never flash. */
export function pickDaily<T>(items: readonly T[]): T | undefined {
  if (!items.length) return undefined;
  const d = new Date();
  const seed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  return items[seed % items.length];
}
