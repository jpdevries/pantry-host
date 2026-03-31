/**
 * Offline mutation queue — mutations that fail while offline are stored here
 * and replayed in order when the device comes back online.
 */

import { gql } from '@/lib/gql';

const QUEUE_KEY = 'offlineQueue';

interface QueuedMutation {
  query: string;
  variables: Record<string, unknown>;
  ts: number;
}

function load(): QueuedMutation[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? (JSON.parse(raw) as QueuedMutation[]) : [];
  } catch {
    return [];
  }
}

function save(queue: QueuedMutation[]): void {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
  } catch { /* ignore */ }
}

export function enqueue(query: string, variables: Record<string, unknown>): void {
  const queue = load();
  queue.push({ query, variables, ts: Date.now() });
  save(queue);
}

/**
 * Replay all queued mutations in order. Mutations that succeed are removed.
 * If one fails, we stop replaying (preserve order) and leave the rest queued.
 */
export async function flush(): Promise<void> {
  const queue = load();
  if (queue.length === 0) return;

  const remaining: QueuedMutation[] = [];
  let failed = false;

  for (const item of queue) {
    if (failed) {
      remaining.push(item);
      continue;
    }
    try {
      await gql(item.query, item.variables);
    } catch {
      failed = true;
      remaining.push(item);
    }
  }

  save(remaining);
}

export function queueLength(): number {
  return load().length;
}
