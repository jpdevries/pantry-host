import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import { listBlueskyCollections, fetchBlueskyCollection, fetchBlueskyRecipe } from '@pantry-host/shared/bluesky';
import ImportGrid, { captureActiveElement } from '@pantry-host/shared/components/ImportGrid';

const FEED_API = 'https://feed.pantryhost.app/api/handles';

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

const CREATE_RECIPE = `mutation(
  $title: String!, $instructions: String!, $ingredients: [RecipeIngredientInput!]!,
  $description: String, $servings: Int, $prepTime: Int, $cookTime: Int,
  $tags: [String!], $photoUrl: String, $sourceUrl: String, $kitchenSlug: String
) {
  createRecipe(
    title: $title, instructions: $instructions, ingredients: $ingredients,
    description: $description, servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
    tags: $tags, photoUrl: $photoUrl, sourceUrl: $sourceUrl, kitchenSlug: $kitchenSlug
  ) { id slug }
}`;

const CREATE_MENU = `mutation(
  $title: String!, $description: String, $recipes: [MenuRecipeInput!]!, $kitchenSlug: String
) {
  createMenu(title: $title, description: $description, recipes: $recipes, kitchenSlug: $kitchenSlug) { id slug }
}`;

const BLUESKY_VIEWBOX = '0 0 600 530';
const BLUESKY_PATH = 'M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z';

interface Props { kitchen: string; }

export default function BlueskyMenuFeedsPage({ kitchen }: Props) {
  const menusBase = kitchen === 'home' ? '/menus' : `/kitchens/${kitchen}/menus`;
  const [collections, setCollections] = useState<FeedCollection[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState<{ done: number; total: number } | null>(null);

  useEffect(() => {
    (async () => {
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
      const item = collections.find((c) => c.atUri === atUri);
      if (!item) { done++; continue; }
      try {
        const collection = await fetchBlueskyCollection(atUri);
        const recipeIds: string[] = [];
        for (const recipeUri of collection.recipeUris) {
          try {
            const recipe = await fetchBlueskyRecipe(recipeUri);
            const result = await gql<{ createRecipe: { id: string; slug: string } }>(CREATE_RECIPE, {
              title: recipe.title,
              description: recipe.description ?? null,
              instructions: recipe.instructions,
              servings: recipe.servings ?? null,
              prepTime: recipe.prepTime ?? null,
              cookTime: recipe.cookTime ?? null,
              tags: recipe.tags ?? [],
              photoUrl: recipe.photoUrl ?? null,
              sourceUrl: recipe.sourceUrl,
              ingredients: recipe.ingredients,
              kitchenSlug: kitchen,
            });
            recipeIds.push(result.createRecipe.id);
          } catch (err) {
            console.error('Recipe import failed:', err);
          }
        }
        await gql(CREATE_MENU, {
          title: collection.name,
          description: collection.description ?? null,
          recipes: recipeIds.map((recipeId) => ({ recipeId })),
          kitchenSlug: kitchen,
        });
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
    <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <a href={`${menusBase}#stage`} className="text-sm text-[var(--color-text-secondary)] hover:text-accent transition-colors mb-4 inline-block">
          &larr; Menus
        </a>
        <div className="flex items-center gap-3 mb-2">
          <svg fill="currentColor" viewBox={BLUESKY_VIEWBOX} width={28} height={24} aria-hidden="true" className="opacity-60 shrink-0">
            <path d={BLUESKY_PATH} />
          </svg>
          <h1 className="text-4xl font-bold">Bluesky Menus</h1>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)]">
          Browsing {loading ? '...' : `${collections.length} collections from ${new Set(collections.map((c) => c.handle)).size} publishers`} on AT Protocol
        </p>
      </div>

      <div className="mb-4">
        <label htmlFor="bsky-search" className="text-xs font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1 block">Search</label>
        <input
          id="bsky-search"
          type="search"
          placeholder="weeknight dinners, holiday meals"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="field-input w-full"
        />
      </div>

      {/* Skip link */}
      <a href="#bsky-collections" className="sr-only focus:not-sr-only focus:inline-block focus:mb-2 focus:text-sm focus:underline focus:text-accent">
        Skip to collections
      </a>

      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="card rounded-xl h-48 animate-pulse" />
          ))}
        </div>
      )}

      {!loading && (
        <>
          <ImportGrid
            importing={importing}
            importingLabel={importProgress ? `Importing ${importProgress.done}/${importProgress.total}...` : undefined}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4"
            onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && selected.size > 0) { e.preventDefault(); handleBulkImport(); } }}
            ariaKeyshortcuts="Meta+Enter"
          >
            <div id="bsky-collections" className="sr-only" />
            {filtered.map((item) => {
              const isSelected = selected.has(item.atUri);
              return (
                <label key={item.atUri} className={`card rounded-xl overflow-hidden flex flex-col cursor-pointer transition-colors group ${isSelected ? 'border-accent' : ''}`}>
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

          {selected.size > 0 && (
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
        </>
      )}

      {!loading && filtered.length === 0 && (
        <p className="text-center text-[var(--color-text-secondary)] py-12">No collections match your search.</p>
      )}

      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8">
        Powered by <a href="https://atproto.com" target="_blank" rel="noopener noreferrer" className="underline">AT Protocol</a> · Handle registry at <a href="https://feed.pantryhost.app/api/handles" target="_blank" rel="noopener noreferrer" className="underline">feed.pantryhost.app</a>
      </p>
    </main>
  );
}
