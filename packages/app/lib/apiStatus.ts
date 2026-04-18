/**
 * Tracks whether the GraphQL API (port 4001) is reachable — independent of
 * navigator.onLine. The phone at the grocery store has 5G but can't reach
 * the Mac Mini at home. This module detects that.
 */

import { apiUrl } from './apiUrl';

export const API_STATUS_EVENT = 'api-status-change';

let _online = true;
let _pollTimer: ReturnType<typeof setInterval> | null = null;
let _flushFn: (() => Promise<void>) | null = null;

export function registerFlush(fn: () => Promise<void>): void {
  _flushFn = fn;
}

export function isApiOnline(): boolean {
  return _online;
}

export function setApiOnline(online: boolean): void {
  if (online === _online) return;
  _online = online;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(API_STATUS_EVENT, { detail: { online } }));
  }
  if (!online) {
    startPolling();
  } else {
    stopPolling();
    _flushFn?.().catch(console.error);
  }
}

async function checkApi(): Promise<void> {
  try {
    const res = await fetch(apiUrl('/graphql'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) setApiOnline(true);
  } catch {
    // still unreachable — keep polling
  }
}

export function startPolling(): void {
  if (_pollTimer != null) return;
  _pollTimer = setInterval(() => { checkApi().catch(console.error); }, 15_000);
}

export function stopPolling(): void {
  if (_pollTimer != null) {
    clearInterval(_pollTimer);
    _pollTimer = null;
  }
}
