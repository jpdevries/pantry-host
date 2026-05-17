/**
 * Stub — the web PWA has no remote API server.
 * Always reports as "online" since data is local.
 */

const listeners = new Set<(online: boolean) => void>();

export function setApiOnline(_online: boolean) {
  // no-op in browser-only mode
}

export function isApiOnline(): boolean {
  return true; // local SQLite is always available
}

export function onApiStatusChange(fn: (online: boolean) => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
