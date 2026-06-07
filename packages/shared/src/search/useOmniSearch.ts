/**
 * useOmniSearch — debounced parallel fan-out across every active adapter.
 *
 * Results stream in progressively: each source updates the merged list (in
 * adapter order) as soon as it resolves, so fast sources (Public Domain,
 * TheMealDB) show before slow ones (Cooklang). A monotonic request id guards
 * against out-of-order/stale responses when the query changes mid-flight.
 */
import { useEffect, useRef, useState } from 'react';
import type { OmniAdapter, OmniResult, PerSourceState } from './types';

export interface UseOmniSearchResult {
  results: OmniResult[];
  perSource: Record<string, PerSourceState>;
  /** True while at least one source is still in flight for the current query. */
  loading: boolean;
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

export function useOmniSearch(
  adapters: OmniAdapter[],
  query: string,
  opts?: { debounceMs?: number },
): UseOmniSearchResult {
  const debounceMs = opts?.debounceMs ?? 400;
  const [results, setResults] = useState<OmniResult[]>([]);
  const [perSource, setPerSource] = useState<Record<string, PerSourceState>>({});
  const [loading, setLoading] = useState(false);
  const reqId = useRef(0);

  // Hosts typically rebuild `adapters` each render (buildOmniAdapters(ctx)).
  // Read the latest closures from a ref, but only re-run the effect when the
  // query or the *set* of source ids changes — not on every render.
  const adaptersRef = useRef(adapters);
  adaptersRef.current = adapters;
  const sig = adapters.map((a) => a.id).join(',');

  useEffect(() => {
    const adapters = adaptersRef.current;
    const q = query.trim();
    const id = ++reqId.current;

    // Shortest minChars across adapters gates whether we search at all.
    const floor = adapters.length ? Math.min(...adapters.map((a) => a.minChars)) : 2;
    if (q.length < floor) {
      setResults([]);
      setPerSource({});
      setLoading(false);
      return;
    }

    const timer = setTimeout(() => {
      setLoading(true);

      // Seed per-source state: loading vs skipped-too-short.
      const init: Record<string, PerSourceState> = {};
      for (const a of adapters) {
        init[a.id] = q.length < a.minChars
          ? { status: 'skipped', count: 0, note: `type ${a.minChars}+ chars` }
          : { status: 'loading', count: 0 };
      }
      setPerSource(init);

      // Accumulate per source; re-flatten in adapter order on each resolution.
      const bySource = new Map<string, OmniResult[]>();
      const flatten = () => adapters.flatMap((a) => bySource.get(a.id) ?? []);

      const runnable = adapters.filter((a) => q.length >= a.minChars);
      let remaining = runnable.length;
      if (remaining === 0) {
        setLoading(false);
        return;
      }

      for (const a of runnable) {
        a.search(q)
          .then((rows) => {
            if (id !== reqId.current) return;
            bySource.set(a.id, rows);
            setResults(flatten());
            setPerSource((prev) => ({ ...prev, [a.id]: { status: 'done', count: rows.length } }));
          })
          .catch((e) => {
            if (id !== reqId.current) return;
            setPerSource((prev) => ({ ...prev, [a.id]: { status: 'error', count: 0, error: errMsg(e) } }));
          })
          .finally(() => {
            if (id !== reqId.current) return;
            remaining -= 1;
            if (remaining === 0) setLoading(false);
          });
      }
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [query, sig, debounceMs]);

  return { results, perSource, loading };
}
