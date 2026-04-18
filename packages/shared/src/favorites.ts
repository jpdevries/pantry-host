/**
 * Favorites — recipe IDs the user has starred from the recipe-detail
 * page. Stored as a JSON array in localStorage under the key
 * `favorites`. Used by:
 *   - RecipeDetailPage (write, toggle, read-current-state)
 *   - home pages (read to render a "Your Favorites" section)
 *   - RecipesIndexPage / RecipesPage (filter when ?favorites=1)
 *
 * Stays a thin string[] rather than a richer object so there's no
 * schema version to carry; if a parse ever fails we return empty and
 * the next write repairs the store.
 *
 * Zero React dependency — usable from any surface (component, page,
 * or plain function) so the two packages can't drift on key name,
 * dedupe rule, or toggle semantics.
 */

export const FAVORITES_KEY = 'favorites';

/** Read the current favorites list. Defensive: missing, malformed, or
 *  non-array values all resolve to []. Safe for SSR — returns [] when
 *  localStorage is unavailable. */
export function readFavorites(): string[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string' && x.length > 0)
      : [];
  } catch {
    return [];
  }
}

/** Overwrite the favorites list. Deduplicated, dropped entries that
 *  don't look like IDs. No-op under SSR. */
export function writeFavorites(ids: readonly string[]): void {
  if (typeof localStorage === 'undefined') return;
  const clean = [...new Set(ids)].filter((x) => typeof x === 'string' && x.length > 0);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(clean));
}

/** Toggle one recipe id in/out of the favorites list and return the
 *  new list. Useful for the recipe-detail button: call + setState in
 *  one step. */
export function toggleFavorite(id: string): string[] {
  const current = readFavorites();
  const next = current.includes(id)
    ? current.filter((x) => x !== id)
    : [...current, id];
  writeFavorites(next);
  return next;
}

/** Convenience: is this id currently favorited? */
export function isFavorite(id: string): boolean {
  return readFavorites().includes(id);
}
