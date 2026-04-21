import { useState, useEffect, useRef } from 'react';
import { gql } from '@/lib/gql';
import { listBlueskyCollections, type BlueskyCollectionRecord } from '@pantry-host/shared/bluesky';
import { importBlueskyCollection } from '@pantry-host/shared/bluesky-import';
import ImportGrid, { captureActiveElement } from '@pantry-host/shared/components/ImportGrid';

const FEED_API = 'https://feed.pantryhost.app/api/handles';
const FEED_RECIPES_API = 'https://feed.pantryhost.app/api/recipes';
const PAGE_SIZE = 50;
const COLLECTION_LEXICON = 'exchange.recipe.collection';

const SEED_HANDLES = [
  'joshhuckabee.com', 'recipe.exchange', 'pixeline.be',
  'stephenhunter.xyz', 'bmann.ca', 'rdur.dev',
];

interface FeedCollection {
  atUri: string;
  name: string;
  description: string | null;
  recipeCount: number;
  handle: string;
}

const BLUESKY_VIEWBOX = '0 0 600 530';
const BLUESKY_PATH = 'M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z';

interface Props { kitchen: string; }

export default function BlueskyMenuFeedsPage({ kitchen }: Props) {
  const menusBase = `/kitchens/${kitchen}/menus`;
  const [collections, setCollections] = useState<FeedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [mode, setMode] = useState<'bulk' | 'browse'>(() => {
    if (typeof window === 'undefined') return 'browse';
    return (localStorage.getItem('bsky-menu-feeds-mode') as 'bulk' | 'browse') || 'browse';
  });
  useEffect(() => {
    if (typeof window !== 'undefined') localStorage.setItem('bsky-menu-feeds-mode', mode);
  }, [mode]);

  const [cursor, setCursor] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [serverFeedAvailable, setServerFeedAvailable] = useState(true);

  const focusIdxRef = useRef<number | null>(null);
  const loadMoreBtnRef = useRef<HTMLButtonElement | null>(null);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(`${FEED_RECIPES_API}?collection=${encodeURIComponent(COLLECTION_LEXICON)}&limit=${PAGE_SIZE}`);
        if (res.ok) {
          const data = (await res.json()) as {
            recipes: Array<{ atUri: string; did: string; handle: string; value: BlueskyCollectionRecord; createdAt: string }>;
            cursor: string | null;
          };
          const converted: FeedCollection[] = data.recipes.map((r) => ({
            atUri: r.atUri,
            handle: r.handle,
            name: r.value.name,
            description: r.value.text ?? null,
            recipeCount: r.value.recipes?.length ?? 0,
          }));
          setCollections(converted);
          setCursor(data.cursor);
          setLoading(false);
          return;
        }
      } catch {
        // fall through
      }

      setServerFeedAvailable(false);
      let handles: string[];
      try {
        const res = await fetch(FEED_API);
        if (res.ok) {
          const data = (await res.json()) as { handle: string }[];
          handles = data.map((d) => d.handle);
        } else {
          handles = SEED_HANDLES;
        }
      } catch {
        handles = SEED_HANDLES;
      }

      const results = await Promise.allSettled(
        handles.map((h) => listBlueskyCollections(h))
      );

      const all: FeedCollection[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled') {
          for (const item of r.value.collections) {
            all.push({ ...item, handle: r.value.handle });
          }
        }
      }

      setCollections(all);
      setLoading(false);
    })();
  }, []);

  async function loadMore() {
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(`${FEED_RECIPES_API}?collection=${encodeURIComponent(COLLECTION_LEXICON)}&limit=${PAGE_SIZE}&cursor=${encodeURIComponent(cursor)}`);
      if (res.ok) {
        const data = (await res.json()) as {
          recipes: Array<{ atUri: string; did: string; handle: string; value: BlueskyCollectionRecord; createdAt: string }>;
          cursor: string | null;
        };
        const converted: FeedCollection[] = data.recipes.map((r) => ({
          atUri: r.atUri,
          handle: r.handle,
          name: r.value.name,
          description: r.value.text ?? null,
          recipeCount: r.value.recipes?.length ?? 0,
        }));
        setCollections((prev) => {
          focusIdxRef.current = prev.length;
          return [...prev, ...converted];
        });
        setCursor(data.cursor);
        setAnnouncement(`Loaded ${converted.length} more menus.${data.cursor ? '' : ' End of feed.'}`);
      }
    } catch {
      // ignore
    }
    setLoadingMore(false);
  }

  useEffect(() => {
    if (focusIdxRef.current === null) return;
    const idx = focusIdxRef.current;
    focusIdxRef.current = null;
    requestAnimationFrame(() => {
      const cards = document.querySelectorAll<HTMLElement>('[data-bsky-card]');
      const target = cards[idx];
      if (target) {
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: false });
        target.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  }, [collections.length]);

  const filtered = collections.filter((c) => {
    if (search) {
      const q = search.toLowerCase();
      if (!c.name.toLowerCase().includes(q) &&
          !c.description?.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  function toggleSelect(atUri: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(atUri) ? next.delete(atUri) : next.add(atUri);
      return next;
    });
  }

  async function handleBulkImport() {
    if (selected.size === 0 || importing) return;
    captureActiveElement();
    setImporting(true);
    setImportProgress({ done: 0, total: selected.size });
    let done = 0;
    for (const atUri of selected) {
      try {
        await importBlueskyCollection({ atUri, gql, kitchenSlug: kitchen });
      } catch (err) {
        console.error('Collection import failed:', err);
      }
      done++;
      setImportProgress({ done, total: selected.size });
      if (done < selected.size) await new Promise((r) => setTimeout(r, 300));
    }
    setImporting(false);
    setImportProgress(null);
    window.location.href = `${menusBase}#stage`;
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <a href={`${menusBase}#stage`} className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
          &larr; Menus
        </a>
        <div className="flex items-center gap-3 mb-2">
          <svg fill="currentColor" viewBox={BLUESKY_VIEWBOX} width={28} height={24} aria-hidden="true" className="opacity-60 shrink-0">
            <path d={BLUESKY_PATH} />
          </svg>
          <h1 id="bluesky-menus" className="text-3xl font-bold">Bluesky Menus</h1>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Browsing {loading ? '…' : `${collections.length} menus from ${new Set(collections.map((c) => c.handle)).size} publishers`} on AT Protocol
        </p>
      </div>

      {/* Search */}
      <div className="mb-4">
        <label htmlFor="bsky-menu-search" className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1 block">Search</label>
        <input
          id="bsky-menu-search"
          type="search"
          placeholder="weeknight dinners"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field-input w-full"
        />
      </div>

      {/* Skip link */}
      <a href="#bluesky-menus" className="sr-only focus:not-sr-only focus:inline-block focus:mb-2 focus:text-sm focus:underline focus:text-accent">
        Skip to menus
      </a>

      {/* Mode toggle */}
      <fieldset className="mb-6 card p-3 text-sm">
        <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">User Flow</legend>
        <div className="flex flex-wrap gap-4 px-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bsky-menu-mode"
              value="browse"
              checked={mode === 'browse'}
              onChange={() => setMode('browse')}
              className="accent-accent"
            />
            <span>Browse &amp; Import</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="radio"
              name="bsky-menu-mode"
              value="bulk"
              checked={mode === 'bulk'}
              onChange={() => setMode('bulk')}
              className="accent-accent"
            />
            <span>Bulk Import</span>
          </label>
        </div>
      </fieldset>

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      )}

      {/* Collection grid */}
      {!loading && (
        <>
          <ImportGrid
            importing={importing}
            importingLabel={importProgress ? `Importing ${importProgress.done}/${importProgress.total}…` : undefined}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && selected.size > 0) { e.preventDefault(); handleBulkImport(); } }}
            ariaKeyshortcuts="Meta+Enter"
          >
            {filtered.map((item) => {
              const isSelected = selected.has(item.atUri);

              const body = (
                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{item.name}</h3>
                    {item.description && (
                      <p className="text-xs text-[var(--color-text-secondary)] mb-1 line-clamp-2">{item.description}</p>
                    )}
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      {item.recipeCount} {item.recipeCount === 1 ? 'recipe' : 'recipes'} · @{item.handle}
                    </p>
                  </div>
                </div>
              );

              if (mode === 'browse') {
                const path = `/kitchens/${kitchen}/at/${item.atUri.replace(/^at:\/\//, '')}#stage`;
                return (
                  <a
                    key={item.atUri}
                    href={path}
                    data-bsky-card
                    className="card rounded-xl overflow-hidden flex flex-col transition-colors hover:border-accent"
                  >
                    {body}
                  </a>
                );
              }

              return (
                <label key={item.atUri} data-bsky-card className={`card rounded-xl overflow-hidden flex flex-col cursor-pointer transition-colors group ${isSelected ? 'border-accent' : ''}`}>
                  <div className="p-4 flex-1 flex flex-col">
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(item.atUri)}
                        className="mt-1 w-4 h-4 shrink-0 accent-accent"
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-sm leading-snug mb-1 line-clamp-2">{item.name}</h3>
                        {item.description && (
                          <p className="text-xs text-[var(--color-text-secondary)] mb-1 line-clamp-2">{item.description}</p>
                        )}
                        <p className="text-xs text-[var(--color-text-secondary)]">
                          {item.recipeCount} {item.recipeCount === 1 ? 'recipe' : 'recipes'} · @{item.handle}
                        </p>
                      </div>
                    </div>
                  </div>
                  {isSelected && selected.size > 0 && (
                    <button type="button" onClick={(e) => { e.preventDefault(); handleBulkImport(); }} className="hidden group-focus-within:block btn-primary text-xs mx-3 mb-3 w-[calc(100%-1.5rem)]">
                      Import {selected.size} selected
                    </button>
                  )}
                </label>
              );
            })}
          </ImportGrid>

          {mode === 'bulk' && selected.size > 0 && (
            <div className="sticky bottom-4 mt-6 flex justify-center">
              <button
                type="button"
                onClick={handleBulkImport}
                disabled={importing}
                className="btn-primary disabled:opacity-50 shadow-lg"
              >
                Import {selected.size} selected
              </button>
            </div>
          )}

          {serverFeedAvailable && cursor && (
            <div className="mt-6 flex justify-center">
              <button
                ref={loadMoreBtnRef}
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                aria-busy={loadingMore}
                aria-describedby="bluesky-menus"
                className="btn-secondary disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}

          <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
            {announcement}
          </div>
        </>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-[var(--color-text-secondary)] py-12">No menus match your search.</p>
      )}

      {/* Footer */}
      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8">
        Powered by <a href="https://atproto.com" target="_blank" rel="noopener noreferrer" className="underline">AT Protocol</a> · Aggregated at <a href="https://feed.pantryhost.app/api/recipes?collection=exchange.recipe.collection" target="_blank" rel="noopener noreferrer" className="underline">feed.pantryhost.app</a>
      </p>
    </div>
  );
}
