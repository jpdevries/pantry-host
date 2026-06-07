/**
 * OmniSearch — the shared "Search All Recipes" surface.
 *
 * One search bar fans a query across every active data source (via
 * `useOmniSearch`) and merges the hits into a single grid, each card badged
 * with its source so the user can finally see *which* source has the recipe
 * they're after. Mirrors the per-source import tabs' UX (User Flow radios,
 * Browse vs Bulk, ImportGrid) but unified.
 *
 * Package-agnostic: the host injects how to render an internal link
 * (`renderResultLink` — `<a>` in the Rex app, `<Link>` in the web PWA) and how
 * to persist a recipe (`createRecipe`). Build the adapter list with
 * `buildOmniAdapters(ctx)` and memoize it before passing in.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { MagnifyingGlass, CookingPot } from '@phosphor-icons/react';
import ImportGrid, { captureActiveElement, restoreFocus } from './ImportGrid';
import { isServer } from '../env';
import { useOmniSearch } from '../search/useOmniSearch';
import { RECIPE_CATEGORY_FILTERS, matchesCategories } from '../search/categories';
import { importOmniResult, type ParsedRecipe } from '../search/importer';
import type { OmniAdapter, OmniResult } from '../search/types';

type Mode = 'browse' | 'bulk';

export interface OmniSearchProps {
  /** Active adapters — build with `buildOmniAdapters(ctx)` and memoize. */
  adapters: OmniAdapter[];
  /** Needed to import recipe-api results (re-fetches full detail by id). */
  recipeApiKey?: string | null;
  /** Wrap a card in an internal link to the per-source import-detail page. */
  renderResultLink: (result: OmniResult, children: React.ReactNode) => React.ReactNode;
  /** Persist one imported recipe (host runs the GraphQL createRecipe mutation). */
  createRecipe: (recipe: ParsedRecipe) => Promise<void>;
  /** Called after a fully-successful bulk import (e.g. navigate to /recipes). */
  onImported?: () => void;
}

const keyOf = (r: OmniResult) => `${r.source}:${r.id}`;

export default function OmniSearch({
  adapters,
  recipeApiKey,
  renderResultLink,
  createRecipe,
  onImported,
}: OmniSearchProps) {
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState<Mode>(() => {
    if (isServer) return 'browse';
    return (localStorage.getItem('omni-search-mode') as Mode) || 'browse';
  });
  const [categories, setCategories] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    if (!isServer) localStorage.setItem('omni-search-mode', mode);
  }, [mode]);

  const { results, loading } = useOmniSearch(adapters, query);

  const filtered = useMemo(
    () => results.filter((r) => matchesCategories(r.tags, categories)),
    [results, categories],
  );

  // Drop selections that fell out of the result set (query/category changed).
  const liveKeys = useRef<Set<string>>(new Set());
  liveKeys.current = new Set(filtered.map(keyOf));

  const hasQuery = query.trim().length >= 2;
  const selectedCount = filtered.filter((r) => selected.has(keyOf(r))).length;

  function toggleCategory(key: string) {
    setCategories((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  function toggleSelect(r: OmniResult) {
    const k = keyOf(r);
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }

  async function handleBulkImport() {
    const chosen = filtered.filter((r) => selected.has(keyOf(r)));
    if (chosen.length === 0) return;
    const prevFocus = captureActiveElement();
    setImporting(true);
    setImportProgress({ done: 0, total: chosen.length });
    setImportError(null);
    let done = 0;
    let failed = 0;
    for (const r of chosen) {
      try {
        await importOmniResult(r, { recipeApiKey, createRecipe });
      } catch (err) {
        console.error('omni import failed', r, err);
        failed++;
      }
      done++;
      setImportProgress({ done, total: chosen.length });
    }
    setImporting(false);
    setImportProgress(null);
    if (failed > 0 && failed === chosen.length) {
      setImportError('All imports failed.');
      restoreFocus(prevFocus);
    } else if (failed > 0) {
      setImportError(`${chosen.length - failed} of ${chosen.length} imported. ${failed} failed.`);
      setSelected(new Set());
      restoreFocus(prevFocus);
    } else {
      setSelected(new Set());
      onImported?.();
    }
  }

  return (
    <section aria-labelledby="omni-search-heading" className="mb-8">
      <h1 id="omni-search-heading" className="text-3xl font-bold mb-1">
        Search All Recipe Sources
      </h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-4 legible pretty max-w-prose">
        One search across every community data source at once. Each result is badged with where it came from — import any of them into your local pantry.
      </p>

      {/* Search bar */}
      <div className="relative mb-4">
        <MagnifyingGlass size={20} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] pointer-events-none" aria-hidden />
        <input
          type="search"
          name="omni-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="eggplant parm, vegetable curry, old fashioned…"
          aria-label="Search all recipe data sources"
          // py-3 + pl-11 override .field-input's padding shorthand (utilities layer
          // beats the components layer); pl-11 clears the absolutely-positioned 20px
          // search icon at left-3. pl-11 is safelisted in the app's globals.css
          // @source inline(...) because Rex doesn't scan this shared component for
          // Tailwind candidates (gotcha #10); the web package scans it natively.
          className="field-input w-full text-lg py-3 pl-11"
        />
      </div>

      {/* User Flow + Category filters */}
      <div className="flex flex-col gap-3 mb-4">
        <fieldset className="card p-3 text-sm">
          <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">User Flow</legend>
          <div className="flex flex-wrap gap-4 px-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="omni-mode" value="browse" checked={mode === 'browse'} onChange={() => setMode('browse')} className="accent-accent" />
              <span>Browse &amp; Import</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="omni-mode" value="bulk" checked={mode === 'bulk'} onChange={() => setMode('bulk')} className="accent-accent" />
              <span>Bulk Import</span>
            </label>
          </div>
        </fieldset>

        <div>
          <p className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">Filter by category</p>
          <div className="flex flex-wrap gap-2">
            {RECIPE_CATEGORY_FILTERS.map((f) => {
              const on = categories.includes(f.key);
              return (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleCategory(f.key)}
                  className={`text-xs px-3 py-1 rounded-full border transition-colors ${on ? 'border-accent bg-[var(--color-accent-subtle)] text-accent' : 'border-[var(--color-border-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
                >
                  {f.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {importError && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-4">{importError}</p>}

      {/* Results */}
      {hasQuery && filtered.length > 0 && (
        <>
          <ImportGrid
            importing={importing}
            importingLabel={importProgress ? `Importing ${importProgress.done}/${importProgress.total}…` : undefined}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && selectedCount > 0) {
                e.preventDefault();
                handleBulkImport();
              }
            }}
            ariaKeyshortcuts="Meta+Enter"
          >
            {filtered.map((r) => {
              const k = keyOf(r);
              const isSel = selected.has(k);
              const imageBlock = (
                <div className="aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)] flex items-center justify-center">
                  {r.image ? (
                    <img src={r.image} alt="" className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <CookingPot size={32} className="text-[var(--color-text-secondary)] opacity-40" aria-hidden />
                  )}
                </div>
              );
              const metaBlock = (
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-sm leading-snug">{r.title}</p>
                  <div className="flex flex-wrap items-center gap-1 mt-1">
                    <span className="tag" data-omni-source>{r.sourceLabel}</span>
                    {r.subtitle && <span className="text-xs text-[var(--color-text-secondary)] truncate">{r.subtitle}</span>}
                  </div>
                </div>
              );

              if (mode === 'browse') {
                return (
                  <div key={k} data-omni-card>
                    {renderResultLink(
                      r,
                      <div className="group card overflow-hidden transition-colors hover:border-accent h-full">
                        {imageBlock}
                        <div className="p-3">{metaBlock}</div>
                      </div>,
                    )}
                  </div>
                );
              }
              return (
                <label
                  key={k}
                  data-omni-card
                  className={`group card overflow-hidden cursor-pointer transition-colors ${isSel ? 'border-accent bg-[var(--color-accent-subtle)]' : ''}`}
                >
                  {imageBlock}
                  <div className="p-3 flex items-start gap-3">
                    <input type="checkbox" checked={isSel} onChange={() => toggleSelect(r)} className="mt-1 w-4 h-4 shrink-0 accent-accent" />
                    {metaBlock}
                  </div>
                </label>
              );
            })}
          </ImportGrid>

          {mode === 'bulk' && selectedCount > 0 && (
            <div className="text-center">
              <button type="button" onClick={handleBulkImport} disabled={importing} aria-busy={importing} className="btn-primary">
                {importing && importProgress ? `Importing ${importProgress.done}/${importProgress.total}…` : `Import Selected (${selectedCount})`}
              </button>
            </div>
          )}
        </>
      )}

      {/* Empty / loading states */}
      {!hasQuery && (
        <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">
          Type at least 2 characters to search every data source at once.
        </p>
      )}
      {hasQuery && loading && filtered.length === 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-40 bg-[var(--color-bg-card)] animate-pulse rounded-xl" />)}
        </div>
      )}
      {hasQuery && !loading && filtered.length === 0 && (
        <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">
          No results found across any data source{categories.length > 0 ? ' for the selected categories' : ''}.
        </p>
      )}
    </section>
  );
}
