/**
 * Web Worker for offloading JSON.parse/stringify from the main thread.
 * Prevents UI jank when serializing large datasets (e.g. Wikibooks ~30MB).
 */

self.onmessage = (e: MessageEvent<{ type: 'parse' | 'stringify'; payload: unknown; id: number }>) => {
  const { type, payload, id } = e.data;
  if (type === 'parse') {
    self.postMessage({ id, result: JSON.parse(payload as string) });
  } else if (type === 'stringify') {
    self.postMessage({ id, result: JSON.stringify(payload) });
  }
};
