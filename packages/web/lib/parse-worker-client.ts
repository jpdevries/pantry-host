/**
 * Client wrapper for the parse-worker. Falls back to synchronous main-thread
 * parsing if worker creation is blocked (CSP, unsupported browser, SSR).
 */

import {
  extractUrls,
  tryParsePantryHostExport,
  type ParsedImportRecipe,
} from '@pantry-host/shared/import-utils';

export interface ParseImportResult {
  exported: ParsedImportRecipe[] | null;
  urls: string[];
}

let worker: Worker | null = null;
let workerDisabled = false;
let requestId = 0;
const pending = new Map<
  number,
  { resolve: (r: ParseImportResult) => void; reject: (e: Error) => void }
>();

function getWorker(): Worker | null {
  if (worker) return worker;
  if (workerDisabled || typeof Worker === 'undefined') return null;
  try {
    worker = new Worker(new URL('./parse-worker.ts', import.meta.url), { type: 'module' });
    worker.onmessage = (e: MessageEvent<{ id: number; result?: ParseImportResult; error?: string }>) => {
      const entry = pending.get(e.data.id);
      if (!entry) return;
      pending.delete(e.data.id);
      if (e.data.error) entry.reject(new Error(e.data.error));
      else if (e.data.result) entry.resolve(e.data.result);
    };
    worker.onerror = () => {
      // If the worker dies once, fall back for future calls rather than
      // retrying forever.
      workerDisabled = true;
      worker = null;
      for (const { reject } of pending.values()) reject(new Error('parse worker error'));
      pending.clear();
    };
    return worker;
  } catch {
    workerDisabled = true;
    return null;
  }
}

function parseOnMainThread(text: string, filename?: string): ParseImportResult {
  const exported = tryParsePantryHostExport(text);
  const urls = exported ? [] : extractUrls(text, filename);
  return { exported, urls };
}

export function parseImport(text: string, filename?: string): Promise<ParseImportResult> {
  const w = getWorker();
  if (!w) return Promise.resolve(parseOnMainThread(text, filename));
  const id = ++requestId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    w.postMessage({ type: 'parseImport', text, filename, id });
  });
}
