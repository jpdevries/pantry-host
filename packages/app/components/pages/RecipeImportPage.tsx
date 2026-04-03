import Head from 'next/head';
import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { gql } from '@/lib/gql';
import { isApiOnline, API_STATUS_EVENT } from '@/lib/apiStatus';
import {
  searchFederationRecipes,
  getFederationRecipe,
  cooklangToRecipe,
  type FederationSearchResult,
  type FederationPagination,
} from '@pantry-host/shared/cooklang';
import { MagnifyingGlass } from '@phosphor-icons/react';

interface ParsedRecipe {
  title?: string;
  description?: string;
  instructions?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
  photoUrl?: string;
  ingredients?: { ingredientName: string; quantity: number | null; unit: string | null }[];
}

type ImportStatus = 'pending' | 'fetching' | 'done' | 'failed';

interface ImportItem {
  url: string;
  status: ImportStatus;
  error?: string;
  recipe?: ParsedRecipe;
  skip: boolean;
}

type Step = 'input' | 'fetching' | 'review' | 'saving';

function parseLdRecipe(data: Record<string, unknown>): ParsedRecipe | null {
  if (data['@type'] !== 'Recipe') return null;
  const parseDur = (iso?: string) => {
    if (!iso) return undefined;
    const m = (iso as string).match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    return m ? (parseInt(m[1] || '0') * 60 + parseInt(m[2] || '0')) || undefined : undefined;
  };
  const structured = data['pantryHost:ingredients'] as { name: string; quantity: number | null; unit: string | null }[] | undefined;
  const ingredients = Array.isArray(structured)
    ? structured.map((ing) => ({ ingredientName: ing.name, quantity: ing.quantity, unit: ing.unit }))
    : ((data.recipeIngredient ?? []) as string[]).map((line) => ({ ingredientName: line, quantity: null, unit: null }));
  return {
    title: data.name as string,
    description: data.description as string | undefined,
    instructions: Array.isArray(data.recipeInstructions)
      ? (data.recipeInstructions as (string | { text: string })[])
          .map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : s.text}`)
          .join('\n')
      : (data.recipeInstructions as string) ?? '',
    servings: typeof data.recipeYield === 'string'
      ? parseInt(data.recipeYield) || undefined
      : data.recipeYield as number | undefined,
    prepTime: parseDur(data.prepTime as string | undefined),
    cookTime: parseDur(data.cookTime as string | undefined),
    tags: [...((data.keywords ?? []) as string[])],
    photoUrl: typeof data.image === 'string' ? data.image : undefined,
    ingredients,
  };
}

function tryParsePantryHostExport(text: string): ParsedRecipe[] | null {
  if (!/<meta\s+name="generator"\s+content="Pantry Host"/i.test(text)) return null;
  const ldMatch = text.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!ldMatch) return null;
  try {
    const data = JSON.parse(ldMatch[1]);
    // Multi-recipe export: JSON-LD is an array
    if (Array.isArray(data)) {
      const recipes = data.map(parseLdRecipe).filter(Boolean) as ParsedRecipe[];
      return recipes.length > 0 ? recipes : null;
    }
    // Single recipe export
    const recipe = parseLdRecipe(data);
    return recipe ? [recipe] : null;
  } catch {
    return null;
  }
}

function extractUrls(text: string, filename?: string): string[] {
  const isHtml = filename?.endsWith('.html') || /<A HREF=/i.test(text);
  const isCsv = filename?.endsWith('.csv');

  if (isHtml) {
    return Array.from(text.matchAll(/<A HREF="([^"]+)"/gi))
      .map((m) => m[1])
      .filter((u) => /^https?:\/\//i.test(u));
  }

  if (isCsv) {
    const lines = text.split(/\r?\n/);
    const header = lines[0]?.toLowerCase().split(',') ?? [];
    const urlCol = header.findIndex((h) => /^url|link|href|address$/i.test(h.trim()));
    const col = urlCol >= 0 ? urlCol : 0;
    return lines
      .slice(urlCol >= 0 ? 1 : 0)
      .map((l) => l.split(',')[col]?.replace(/^"|"$/g, '').trim() ?? '')
      .filter((u) => /^https?:\/\//i.test(u));
  }

  return text.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => /^https?:\/\//i.test(l));
}

const CREATE_RECIPE = `
  mutation CreateRecipe(
    $title: String!, $description: String, $instructions: String!,
    $servings: Int, $prepTime: Int, $cookTime: Int,
    $tags: [String!], $photoUrl: String,
    $ingredients: [RecipeIngredientInput!]!, $kitchenSlug: String
  ) {
    createRecipe(
      title: $title, description: $description, instructions: $instructions,
      servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
      tags: $tags, photoUrl: $photoUrl,
      ingredients: $ingredients, kitchenSlug: $kitchenSlug
    ) { id }
  }
`;

interface Props { kitchen: string; }

export default function RecipeImportPage({ kitchen }: Props) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  const [step, setStep] = useState<Step>('input');
  const [pasteText, setPasteText] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [items, setItems] = useState<ImportItem[]>([]);
  const [saveProgress, setSaveProgress] = useState(0);
  const [apiOnline, setApiOnline] = useState(true);

  // Cooklang federation state
  const [clQuery, setClQuery] = useState('');
  const [clResults, setClResults] = useState<FederationSearchResult[]>([]);
  const [clPagination, setClPagination] = useState<FederationPagination | null>(null);
  const [clSearching, setClSearching] = useState(false);
  const [clLoadingMore, setClLoadingMore] = useState(false);
  const [clSelected, setClSelected] = useState<Set<number>>(new Set());
  const [clImporting, setClImporting] = useState(false);
  const [clImportProgress, setClImportProgress] = useState<{ done: number; total: number } | null>(null);
  const [clError, setClError] = useState<string | null>(null);
  const clDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  const clSearch = useCallback(async (q: string, page = 1, append = false) => {
    if (!q.trim()) { setClResults([]); setClPagination(null); return; }
    if (page === 1) setClSearching(true);
    else setClLoadingMore(true);
    setClError(null);
    try {
      const data = await searchFederationRecipes(q.trim(), page, 12);
      setClResults((prev) => append ? [...prev, ...data.results] : data.results);
      setClPagination(data.pagination);
    } catch (err) {
      setClError(`Search failed: ${(err as Error).message}`);
    } finally {
      setClSearching(false);
      setClLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(clDebounceRef.current);
    if (!clQuery.trim()) { setClResults([]); setClPagination(null); return; }
    clDebounceRef.current = setTimeout(() => clSearch(clQuery), 300);
    return () => clearTimeout(clDebounceRef.current);
  }, [clQuery, clSearch]);

  function clToggleSelect(id: number) {
    setClSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleCooklangImport() {
    if (clSelected.size === 0) return;
    setClImporting(true);
    setClImportProgress({ done: 0, total: clSelected.size });
    setClError(null);
    const ids = Array.from(clSelected);
    let done = 0;
    for (const id of ids) {
      try {
        const full = await getFederationRecipe(id);
        const recipe = cooklangToRecipe(full);
        await gql(CREATE_RECIPE, {
          title: recipe.title,
          description: recipe.description || null,
          instructions: recipe.instructions,
          servings: recipe.servings ?? null,
          prepTime: recipe.prepTime ?? null,
          cookTime: recipe.cookTime ?? null,
          tags: recipe.tags ?? [],
          photoUrl: recipe.photoUrl ?? null,
          sourceUrl: recipe.sourceUrl ?? null,
          ingredients: recipe.ingredients,
          kitchenSlug: kitchen,
        });
      } catch (err) {
        console.error(`Failed to import recipe ${id}:`, err);
      }
      done++;
      setClImportProgress({ done, total: ids.length });
    }
    setClImporting(false);
    setClImportProgress(null);
    router.push(`${recipesBase}#stage`);
  }

  useEffect(() => {
    setApiOnline(isApiOnline());
    const handler = (e: Event) => setApiOnline((e as CustomEvent).detail.online);
    window.addEventListener(API_STATUS_EVENT, handler);
    return () => window.removeEventListener(API_STATUS_EVENT, handler);
  }, []);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setPasteText(reader.result as string); };
    reader.readAsText(file);
  }

  function handleParse() {
    setParseError(null);
    const filename = fileRef.current?.files?.[0]?.name;
    // Check for Pantry Host HTML export first
    const pantryExports = tryParsePantryHostExport(pasteText);
    if (pantryExports) {
      setItems(pantryExports.map((recipe, i) => ({
        url: recipe.title || `Pantry Host export ${i + 1}`,
        status: 'done' as ImportStatus,
        recipe,
        skip: false,
      })));
      setStep('review');
      return;
    }
    const urls = extractUrls(pasteText, filename);
    if (urls.length === 0) {
      setParseError('No URLs found. Paste recipe URLs (one per line), or upload a bookmarks .html, Pantry Host export .html, or .csv file.');
      return;
    }
    const newItems: ImportItem[] = urls.map((url) => ({ url, status: 'pending', skip: false }));
    setItems(newItems);
    setStep('fetching');
    fetchAll(newItems);
  }

  async function fetchAll(initialItems: ImportItem[]) {
    const BATCH = 3;
    const updated = [...initialItems];

    for (let i = 0; i < updated.length; i += BATCH) {
      const batch = updated.slice(i, i + BATCH);
      await Promise.allSettled(
        batch.map(async (item, batchIdx) => {
          const idx = i + batchIdx;
          updated[idx] = { ...updated[idx], status: 'fetching' };
          setItems([...updated]);

          try {
            const res = await fetch(`http://${window.location.hostname}:4001/fetch-recipe`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ url: item.url }),
            });
            const data = await res.json() as ParsedRecipe & { error?: string };
            if (!res.ok || data.error) throw new Error(data.error ?? `HTTP ${res.status}`);
            if (!data.title) throw new Error('No recipe data found on this page');
            updated[idx] = { ...updated[idx], status: 'done', recipe: data };
          } catch (err) {
            updated[idx] = { ...updated[idx], status: 'failed', error: (err as Error).message };
          }
          setItems([...updated]);
        }),
      );
    }
    setStep('review');
  }

  function toggleSkip(idx: number) {
    setItems((prev) => prev.map((item, i) => i === idx ? { ...item, skip: !item.skip } : item));
  }

  async function handleSave() {
    setStep('saving');
    const toSave = items.filter((item) => item.status === 'done' && !item.skip);
    let saved = 0;

    for (const item of toSave) {
      const r = item.recipe!;
      try {
        await gql(CREATE_RECIPE, {
          title: r.title ?? 'Untitled',
          description: r.description ?? null,
          instructions: r.instructions ?? '',
          servings: r.servings ?? null,
          prepTime: r.prepTime ?? null,
          cookTime: r.cookTime ?? null,
          tags: r.tags ?? [],
          photoUrl: r.photoUrl ?? null,
          ingredients: (r.ingredients ?? []).map((i) => ({
            ingredientName: i.ingredientName,
            quantity: i.quantity ?? null,
            unit: i.unit ?? null,
          })),
          kitchenSlug: kitchen,
        });
      } catch {
        // Continue — don't block the rest
      }
      saved++;
      setSaveProgress(saved);
    }

    router.push(`${recipesBase}#stage`);
  }

  const fetchedCount = items.filter((i) => i.status === 'done' || i.status === 'failed').length;
  const successCount = items.filter((i) => i.status === 'done' && !i.skip).length;
  const failedCount = items.filter((i) => i.status === 'failed' && !i.skip).length;

  return (
    <>
      <Head><title>Import Recipes — Pantry Host</title></Head>

      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <a href={`${recipesBase}#stage`} className="text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] mb-4 inline-block">← Recipes</a>
          <h1 className="text-4xl font-bold">Import Recipes</h1>
        </div>

        {step === 'input' && (
          <div className="space-y-6">
            <div className="p-6 border border-[var(--color-border-card)] bg-[var(--color-bg-card)]">
              <h2 className="text-lg font-bold mb-1">Upload a file</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Choose a recipe <span className="font-mono text-xs">.html</span> or provide bookmarks in <span className="font-mono text-xs">.html</span>,
                <span className="font-mono text-xs">.csv</span>, or a plain URL list as <span className="font-mono text-xs">.txt</span>
              </p>
              <label className="block">
                <span className="sr-only">Choose file</span>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".html,.csv,.txt"
                  onChange={handleFile}
                  className="block w-full text-sm text-[var(--color-text-secondary)]
                    file:mr-4 file:py-2 file:px-4 file:border-0
                    file:text-sm file:font-medium
                    file:bg-[var(--color-accent-subtle)]
                    file:text-[var(--color-text-primary)]
                    hover:file:bg-[var(--color-border-card)]
                    cursor-pointer"
                />
              </label>
            </div>

            <div
              className={`p-6 border border-[var(--color-border-card)] bg-[var(--color-bg-card)] ${!apiOnline ? 'opacity-50' : ''}`}
              {...(!apiOnline ? { inert: '' } : {})}
            >
              <h2 className="text-lg font-bold mb-1">Or paste URLs</h2>
              {!apiOnline && (
                <p className="text-sm text-[var(--color-accent)] mb-3">
                  URL import requires a connection to your Pantry&nbsp;Host server.
                </p>
              )}
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                One URL per line, or paste bookmark HTML or CSV content directly.
              </p>
              <textarea
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                rows={8}
                placeholder={'https://example.com/recipe-1\nhttps://example.com/recipe-2\n…'}
                aria-label="Recipe URLs or file content"
                className="field-input w-full font-mono text-sm"
              />
            </div>

            {parseError && (
              <p role="alert" className="text-sm text-red-600 dark:text-red-400">{parseError}</p>
            )}

            <button
              type="button"
              onClick={handleParse}
              disabled={!pasteText.trim()}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Parse URLs →
            </button>

          {/* Cooklang Federation */}
          <div className="mt-10 pt-8 border-t border-[var(--color-border-card)]">
            <h2 className="text-xl font-bold mb-2">Import from Cooklang Federation</h2>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4 legible pretty">
              Search the <a href="https://cooklang.org" className="underline" rel="noopener noreferrer">Cooklang</a> Federation for community recipes. Select the ones you want and import them.
            </p>

            <div className="relative mb-4">
              <MagnifyingGlass size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]" aria-hidden />
              <input
                type="search"
                value={clQuery}
                onChange={(e) => setClQuery(e.target.value)}
                placeholder="Search federated recipes (e.g. pasta, chicken, breakfast)..."
                className="field-input w-full pl-9"
              />
            </div>

            {clError && <p role="alert" className="text-sm text-red-600 dark:text-red-400 mb-4">{clError}</p>}

            {clSearching && clResults.length === 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className="h-28 bg-[var(--color-bg-card)] animate-pulse" />
                ))}
              </div>
            )}

            {clResults.length > 0 && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4">
                  {clResults.map((r) => {
                    const isSelected = clSelected.has(r.id);
                    return (
                      <label
                        key={r.id}
                        className={`card p-4 cursor-pointer transition-colors ${isSelected ? 'border-accent bg-[var(--color-accent-subtle)]' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => clToggleSelect(r.id)}
                            className="mt-1 w-4 h-4 shrink-0 accent-accent"
                          />
                          <div className="min-w-0">
                            <p className="font-semibold text-sm leading-snug">{r.title}</p>
                            {r.tags.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {r.tags.slice(0, 4).map((t) => (
                                  <span key={t} className="tag">{t}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </label>
                    );
                  })}
                </div>

                {clPagination && clPagination.page < clPagination.total_pages && (
                  <div className="text-center mb-4">
                    <button
                      type="button"
                      onClick={() => clSearch(clQuery, clPagination.page + 1, true)}
                      disabled={clLoadingMore}
                      className="btn-secondary"
                    >
                      {clLoadingMore ? 'Loading\u2026' : `Load More (${clResults.length} of ${clPagination.total})`}
                    </button>
                  </div>
                )}

                {clSelected.size > 0 && (
                  <div className="text-center">
                    <button
                      type="button"
                      onClick={handleCooklangImport}
                      disabled={clImporting}
                      aria-busy={clImporting}
                      className="btn-primary"
                    >
                      {clImporting && clImportProgress
                        ? `Importing ${clImportProgress.done}/${clImportProgress.total}\u2026`
                        : `Import Selected (${clSelected.size})`}
                    </button>
                  </div>
                )}
              </>
            )}

            {!clSearching && clQuery.trim() && clResults.length === 0 && (
              <p className="text-[var(--color-text-secondary)] text-sm text-center py-8">
                No recipes found for &ldquo;{clQuery}&rdquo;. Try a different search term.
              </p>
            )}
          </div>
          </div>
        )}

        {step === 'fetching' && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-[var(--color-accent-subtle)] overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${(fetchedCount / items.length) * 100}%` }} />
              </div>
              <span className="text-sm text-[var(--color-text-secondary)] shrink-0">{fetchedCount} / {items.length}</span>
            </div>
            <ul role="list" className="divide-y divide-[var(--color-border-card)]">
              {items.map((item, idx) => (
                <li key={idx} className="py-3 flex items-center gap-3">
                  <StatusIcon status={item.status} />
                  <span className="flex-1 min-w-0 text-sm truncate text-[var(--color-text-secondary)]">{item.url}</span>
                  {item.status === 'done' && item.recipe?.title && (
                    <span className="text-sm font-medium truncate max-w-[40%]">{item.recipe.title}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-6">
            <p className="text-[var(--color-text-secondary)]">
              <strong className="text-[var(--color-text-primary)]">{successCount}</strong> recipes ready to save
              {failedCount > 0 && <>, <strong className="text-red-500">{failedCount}</strong> failed</>}.
              Remove any you don&apos;t want before saving.
            </p>
            <ul role="list" className="divide-y divide-[var(--color-border-card)]">
              {items.map((item, idx) => (
                !item.skip && (
                  <li key={idx} className={`py-4 flex items-start gap-4 ${item.status === 'failed' ? 'opacity-60' : ''}`}>
                    <StatusIcon status={item.status} />
                    <div className="flex-1 min-w-0">
                      {item.status === 'done' && item.recipe ? (
                        <>
                          <p className="font-semibold truncate">{item.recipe.title}</p>
                          {item.recipe.description && (
                            <p className="text-sm text-[var(--color-text-secondary)] line-clamp-1 mt-0.5">{item.recipe.description}</p>
                          )}
                          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
                            {item.recipe.ingredients?.length ?? 0} ingredients
                            {item.recipe.cookTime ? ` · ${item.recipe.cookTime} min` : ''}
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm truncate text-[var(--color-text-secondary)]">{item.url}</p>
                          {item.error && <p className="text-xs text-red-500 mt-0.5">{item.error}</p>}
                        </>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => toggleSkip(idx)}
                      aria-label={`Remove ${item.recipe?.title ?? item.url}`}
                      className="shrink-0 text-[var(--color-text-secondary)] hover:text-red-500 transition-colors p-1"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                    </button>
                  </li>
                )
              ))}
            </ul>
            <button
              type="button"
              onClick={handleSave}
              disabled={successCount === 0}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Save {successCount} Recipe{successCount !== 1 ? 's' : ''} →
            </button>
          </div>
        )}

        {step === 'saving' && (
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 h-2 bg-[var(--color-accent-subtle)] overflow-hidden">
                <div className="h-full bg-accent transition-all duration-300" style={{ width: `${(saveProgress / successCount) * 100}%` }} />
              </div>
              <span className="text-sm text-[var(--color-text-secondary)] shrink-0">
                Saving {saveProgress} / {successCount}…
              </span>
            </div>
          </div>
        )}
      </main>
    </>
  );
}

function StatusIcon({ status }: { status: ImportStatus }) {
  if (status === 'pending') return <span className="w-5 h-5 shrink-0 rounded-full border-2 border-[var(--color-border-card)]" aria-label="pending" />;
  if (status === 'fetching') return (
    <svg className="w-5 h-5 shrink-0 animate-spin text-accent" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-label="fetching">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
    </svg>
  );
  if (status === 'done') return (
    <svg className="w-5 h-5 shrink-0 text-green-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="success">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
  return (
    <svg className="w-5 h-5 shrink-0 text-red-500" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-label="failed">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  );
}
