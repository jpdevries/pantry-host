/**
 * Stub — the web PWA executes all mutations locally via SQLite.
 * No offline queue needed since there's no remote server.
 */

export function enqueue(_mutation: string, _variables?: Record<string, unknown>): void {
  // no-op — mutations execute directly against SQLite
}

export function getPendingCount(): number {
  return 0;
}
