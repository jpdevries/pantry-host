/**
 * Web Worker for offloading recipe-import text parsing from the main thread.
 *
 * For typical inputs (a handful of URLs, small bookmarks export) this is
 * overkill, but for large inputs — a Pantry Host HTML export with hundreds
 * of recipes, or a multi-megabyte Safari/Chrome bookmarks dump — the regex
 * passes and JSON.parse would otherwise stall the UI for hundreds of ms.
 *
 * Mirrors the pattern in lib/json-worker.ts + storage-opfs.ts:
 *   main thread sends { type, payload, id }
 *   worker replies { id, result } or { id, error }
 */

import {
  extractUrls,
  tryParsePantryHostExport,
  type ParsedImportRecipe,
} from '@pantry-host/shared/import-utils';

type Req = {
  type: 'parseImport';
  text: string;
  filename?: string;
  id: number;
};

type Res = {
  id: number;
  result?: {
    exported: ParsedImportRecipe[] | null;
    urls: string[];
  };
  error?: string;
};

self.onmessage = (e: MessageEvent<Req>) => {
  const { type, text, filename, id } = e.data;
  if (type !== 'parseImport') return;
  try {
    const exported = tryParsePantryHostExport(text);
    const urls = exported ? [] : extractUrls(text, filename);
    const msg: Res = { id, result: { exported, urls } };
    self.postMessage(msg);
  } catch (err) {
    const msg: Res = { id, error: (err as Error).message };
    self.postMessage(msg);
  }
};
