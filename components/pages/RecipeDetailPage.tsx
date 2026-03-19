import Head from 'next/head';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { gql } from '@/lib/gql';
import { cacheSet, cacheGet } from '@/lib/cache';
import { ArrowsOut, ArrowsIn, Trash, Heart, Printer, Circle, CheckCircle } from '@phosphor-icons/react';
import { enqueue } from '@/lib/offlineQueue';
import RecipeCard from '@/components/RecipeCard';
import { HIDDEN_TAGS } from '@/lib/constants';

interface RecipeIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  sourceRecipeId: string | null;
}

interface SubRecipe {
  id: string;
  slug: string | null;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  source: string;
  tags: string[];
  photoUrl: string | null;
  queued: boolean;
}

interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  instructions: string;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  tags: string[];
  requiredCookware: string[];
  source: string;
  sourceUrl: string | null;
  photoUrl: string | null;
  lastMadeAt: string | null;
  queued: boolean;
  ingredients: RecipeIngredient[];
  usedIn: SubRecipe[];
}

const RECIPE_QUERY = `
  query Recipe($id: String!) {
    recipe(id: $id) {
      id slug title description instructions servings prepTime cookTime
      tags requiredCookware source sourceUrl photoUrl lastMadeAt queued
      ingredients { ingredientName quantity unit sourceRecipeId }
      usedIn { id slug title cookTime prepTime servings source tags photoUrl queued }
    }
    cookware { name brand }
  }
`;

const DELETE_RECIPE = `mutation DeleteRecipe($id: String!) { deleteRecipe(id: $id) }`;
const COMPLETE_RECIPE = `mutation CompleteRecipe($id: String!, $servings: Int) { completeRecipe(id: $id, servings: $servings) { id lastMadeAt } }`;
const TOGGLE_QUEUED = `mutation ToggleQueued($id: String!) { toggleRecipeQueued(id: $id) { id queued } }`;
const PANTRY_QUERY = `query Ingredients($kitchenSlug: String) { ingredients(kitchenSlug: $kitchenSlug) { id name quantity unit alwaysOnHand } }`;
const UPDATE_INGREDIENT = `mutation UpdateIngredient($id: String!, $quantity: Float) { updateIngredient(id: $id, quantity: $quantity) { id quantity } }`;

interface PantryItem { id: string; name: string; quantity: number | null; unit: string | null; alwaysOnHand: boolean; }

interface Props { kitchen: string; recipeId: string; }

export default function RecipeDetailPage({ kitchen, recipeId }: Props) {
  const router = useRouter();
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  const cacheKey = `cache:recipe:${recipeId}`;
  const cachedRecipe = typeof window !== 'undefined' ? cacheGet<Recipe>(cacheKey) : null;
  const [recipe, setRecipe] = useState<Recipe | null>(cachedRecipe);
  const [notFound, setNotFound] = useState(false);
  const [isDev, setIsDev] = useState(false);
  const [ageVerified, setAgeVerified] = useState(() => {
    if (typeof window !== 'undefined') return localStorage.getItem('age-verified') === 'true';
    return false;
  });

  const articleRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [servings, setServings] = useState(cachedRecipe?.servings ?? 2);

  const [subRecipes, setSubRecipes] = useState<SubRecipe[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [lastMadeAt, setLastMadeAt] = useState<string | null>(cachedRecipe?.lastMadeAt ?? null);
  const [queued, setQueued] = useState(cachedRecipe?.queued ?? false);
  const [togglingQueue, setTogglingQueue] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favoritedRecipes, setFavoritedRecipes] = useState<SubRecipe[]>([]);
  const [showPantryUpdate, setShowPantryUpdate] = useState(false);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [pantryEdits, setPantryEdits] = useState<Map<string, number>>(new Map());
  const [savingPantry, setSavingPantry] = useState(false);
  const [cookwareLookup, setCookwareLookup] = useState<Record<string, string | null>>({});

  // Read favorite state from localStorage once recipe is known
  useEffect(() => {
    setIsDev(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
  }, []);

  useEffect(() => {
    if (!recipeId) return;
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('favorites') || '[]');
      setFavorited(favs.includes(recipeId));
    } catch { /* ignored */ }
  }, [recipeId]);

  // Fetch favorited recipes for the aside grid
  useEffect(() => {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('favorites') || '[]');
      const others = favs.filter((id) => id !== recipeId);
      if (others.length === 0) { setFavoritedRecipes([]); return; }
      Promise.all(
        others.slice(0, 4).map((id) =>
          gql<{ recipe: SubRecipe | null }>(
            `query FavRecipe($id: String!) { recipe(id: $id) { id slug title cookTime prepTime servings source tags photoUrl queued } }`,
            { id },
          ).then((d) => d.recipe),
        ),
      ).then((results) => setFavoritedRecipes(results.filter((r): r is SubRecipe => r != null)));
    } catch { /* ignored */ }
  }, [favorited]);

  function handleToggleFavorite() {
    try {
      const favs: string[] = JSON.parse(localStorage.getItem('favorites') || '[]');
      let next: string[];
      if (favs.includes(recipeId)) {
        next = favs.filter((id) => id !== recipeId);
      } else {
        next = [...favs, recipeId];
      }
      localStorage.setItem('favorites', JSON.stringify(next));
      setFavorited(!favorited);
    } catch { /* ignored */ }
  }

  useEffect(() => {
    if (!recipeId) return;
    gql<{ recipe: Recipe | null; cookware: { name: string; brand: string | null }[] }>(RECIPE_QUERY, { id: recipeId })
      .then((d) => {
        if (!d.recipe) { setNotFound(true); return; }
        setRecipe(d.recipe);
        setServings(d.recipe.servings ?? 2);
        setLastMadeAt(d.recipe.lastMadeAt);
        setQueued(d.recipe.queued);
        cacheSet(cacheKey, d.recipe);
        const lookup: Record<string, string | null> = {};
        for (const cw of d.cookware ?? []) {
          lookup[cw.name] = cw.brand && cw.brand !== cw.name ? cw.brand : null;
        }
        setCookwareLookup(lookup);
      })
      .catch(() => {
        const cached = cacheGet<Recipe>(cacheKey);
        if (cached) {
          setRecipe(cached);
          setServings(cached.servings ?? 2);
          setLastMadeAt(cached.lastMadeAt);
          setQueued(cached.queued);
        }
      });
  }, [recipeId]);

  // Fetch sub-recipes (ingredients that are themselves recipes)
  useEffect(() => {
    if (!recipe) return;
    const sourceIds = recipe.ingredients
      .map((i) => i.sourceRecipeId)
      .filter((id): id is string => id != null);
    if (sourceIds.length === 0) { setSubRecipes([]); return; }
    Promise.all(
      sourceIds.map((id) =>
        gql<{ recipe: SubRecipe | null }>(
          `query SubRecipe($id: String!) { recipe(id: $id) { id slug title cookTime prepTime servings source tags photoUrl queued } }`,
          { id },
        ).then((d) => d.recipe),
      ),
    ).then((results) => setSubRecipes(results.filter((r): r is SubRecipe => r != null)));
  }, [recipe]);

  const baseServings = recipe?.servings ?? 2;
  const scaleFactor = servings / baseServings;

  const steps = (recipe?.instructions ?? '')
    .split('\n')
    .map((s) => s.replace(/^\d+\.\s*/, '').trim())
    .filter(Boolean);

  const enterZen = useCallback(async () => {
    if (!articleRef.current) return;
    try { await articleRef.current.requestFullscreen(); } catch { /* ignored */ }
  }, []);

  const exitZen = useCallback(() => {
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  }, []);

  useEffect(() => {
    function onFSChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  useEffect(() => {
    if (!isFullscreen) return;
    let lock: WakeLockSentinel | null = null;
    async function acquire() {
      try { lock = await navigator.wakeLock.request('screen'); } catch { /* ignored */ }
    }
    async function onVisibilityChange() {
      if (document.visibilityState === 'visible' && isFullscreen) await acquire();
    }
    acquire();
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => { lock?.release().catch(() => {}); document.removeEventListener('visibilitychange', onVisibilityChange); };
  }, [isFullscreen]);

  async function handleToggleQueue() {
    if (!recipe) return;
    setTogglingQueue(true);
    setQueued((q) => !q);
    try {
      const data = await gql<{ toggleRecipeQueued: { queued: boolean } }>(TOGGLE_QUEUED, { id: recipe.id });
      setQueued(data.toggleRecipeQueued.queued);
    } catch {
      // If offline, the optimistic toggle stands; queue it for sync
      if (!navigator.onLine) {
        enqueue(TOGGLE_QUEUED, { id: recipe.id });
      } else {
        setQueued((q) => !q); // revert on real error
      }
    } finally {
      setTogglingQueue(false);
    }
  }

  async function handleDelete() {
    if (!recipe) return;
    setDeleting(true);
    try {
      await gql(DELETE_RECIPE, { id: recipe.id });
      router.push(`${recipesBase}#stage`);
    } catch {
      setDeleting(false);
      setDeleteConfirm(false);
    }
  }

  async function handleComplete() {
    if (!recipe) return;
    setCompleting(true);
    try {
      const result = await gql<{ completeRecipe: { lastMadeAt: string } }>(COMPLETE_RECIPE, { id: recipe.id, servings });
      // Optimistically set before await to avoid layout shift
      setLastMadeAt((prev) => result.completeRecipe.lastMadeAt ?? prev);
      // Track in localStorage
      try {
        const madeRecipes: Record<string, string> = JSON.parse(localStorage.getItem('madeRecipes') ?? '{}');
        madeRecipes[recipe.id] = result.completeRecipe.lastMadeAt;
        localStorage.setItem('madeRecipes', JSON.stringify(madeRecipes));
      } catch { /* ignore */ }
      // Fetch pantry items and show update modal — only items relevant to this recipe
      const data = await gql<{ ingredients: PantryItem[] }>(PANTRY_QUERY, { kitchenSlug: kitchen });
      const recipeNames = recipe.ingredients.map((ri) => ri.ingredientName.toLowerCase());
      const editable = data.ingredients.filter((i) => {
        if (i.alwaysOnHand || i.quantity == null) return false;
        const lower = i.name.toLowerCase();
        return recipeNames.some((rn) => rn.includes(lower) || lower.includes(rn));
      });
      if (editable.length > 0) {
        setPantryItems(editable);
        setPantryEdits(new Map());
        setShowPantryUpdate(true);
      }
    } finally {
      setCompleting(false);
    }
  }

  async function handleSavePantry() {
    setSavingPantry(true);
    try {
      for (const [id, quantity] of pantryEdits) {
        await gql(UPDATE_INGREDIENT, { id, quantity });
      }
      setShowPantryUpdate(false);
    } finally {
      setSavingPantry(false);
    }
  }

  function toggleIngredient(idx: number) {
    setCheckedIngredients((prev) => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  }

  function scaleQty(qty: number | null) {
    if (qty == null) return null;
    return Math.round(qty * scaleFactor * 100) / 100;
  }

  if (notFound) {
    return (
      <main id="stage" className="min-h-screen px-4 py-10 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Recipe not found</h1>
          <a href={`${recipesBase}#stage`} className="text-amber-600 dark:text-amber-400 hover:underline">← Back to Recipes</a>
        </div>
      </main>
    );
  }

  if (!recipe) {
    return <main id="stage" className="min-h-screen" aria-busy="true" />;
  }

  const isAdult = recipe.tags.some((t) => ['420', 'cannabis', 'adult-only'].includes(t.toLowerCase()));

  if (isAdult && !ageVerified) {
    return (
      <main id="stage" className="min-h-screen px-4 py-10 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold mb-3">Age Verification Required</h1>
          <p className="text-zinc-500 dark:text-zinc-400 mb-6 pretty">This recipe contains adult-only content. You must be 21 or older to view it.</p>
          <div className="flex gap-3 justify-center">
            <button
              type="button"
              onClick={() => { localStorage.setItem('age-verified', 'true'); setAgeVerified(true); }}
              className="btn-primary"
            >
              I&rsquo;m 21+
            </button>
            <a href={`${recipesBase}#stage`} className="btn-secondary">Back to Recipes</a>
          </div>
        </div>
      </main>
    );
  }

  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

  return (
    <>
      <Head>
        <title>{recipe.title} — Pantry Host</title>
        <meta name="description" content={recipe.description ?? `Recipe: ${recipe.title}`} />
      </Head>

      <main id="stage" className="min-h-screen">
        <div className="no-print px-4 py-4 md:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-zinc-200 dark:border-zinc-800 max-w-4xl mx-auto">
          <a href={`${recipesBase}#stage`} className="text-sm text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">← Recipes</a>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <button
              type="button"
              onClick={handleToggleQueue}
              disabled={togglingQueue}
              aria-pressed={queued}
              aria-label={queued ? 'Remove from grocery list' : 'Add to grocery list'}
              className={`btn-secondary text-sm transition-colors ${queued ? 'border-amber-500 text-amber-600 dark:text-amber-400' : ''}`}
            >
              {queued ? '✓ On List' : '+ Grocery List'}
            </button>
            <a href={`${recipesBase}/${recipe.slug ?? recipe.id}/edit#stage`} className="btn-secondary text-sm">Edit</a>
            {deleteConfirm ? (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-zinc-500">Delete?</span>
                <button type="button" autoFocus onClick={handleDelete} disabled={deleting} aria-label="Confirm delete" className="btn-danger text-sm">{deleting ? 'Deleting…' : 'Yes'}</button>
                <button type="button" onClick={() => setDeleteConfirm(false)} className="btn-secondary text-sm">No</button>
              </div>
            ) : (
              <button type="button" onClick={() => setDeleteConfirm(true)} aria-label="Delete recipe" className="btn-secondary p-2 hover:text-red-500">
                <Trash size={16} aria-hidden />
              </button>
            )}
            <button type="button" onClick={isFullscreen ? exitZen : enterZen} aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} aria-pressed={isFullscreen} className="btn-secondary p-2">
              {isFullscreen ? <ArrowsIn size={18} aria-hidden /> : <ArrowsOut size={18} aria-hidden />}
            </button>
          </div>
        </div>

        <article ref={articleRef} className="px-4 py-8 md:px-8 max-w-4xl mx-auto" aria-label={recipe.title}>
          <button
            type="button"
            onClick={exitZen}
            aria-label="Exit full screen"
            className="zen-exit-btn fixed top-4 right-4 z-50 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full backdrop-blur transition-colors hidden outline outline-1 outline-current"
          >
            <ArrowsIn size={18} aria-hidden />
          </button>
          {recipe.photoUrl && (
            <div className="mb-8 aspect-[16/9] overflow-hidden bg-zinc-100 dark:bg-zinc-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={recipe.photoUrl} alt={recipe.title} className="w-full h-full object-cover" />
            </div>
          )}

          <header className="mb-8">
            <div className="flex flex-wrap gap-2 mb-3">
              {recipe.source === 'ai-generated' && (
                <span className="tag inline-flex items-center gap-1" title="AI-generated recipe">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 640 512" fill="currentColor" aria-hidden="true">
                    <path d="M192,416h64V384H192ZM576,224H544V192a95.99975,95.99975,0,0,0-96-96H336V16a16,16,0,0,0-32,0V96H192a95.99975,95.99975,0,0,0-96,96v32H64a31.99908,31.99908,0,0,0-32,32V384a32.00033,32.00033,0,0,0,32,32H96a95.99975,95.99975,0,0,0,96,96H448a95.99975,95.99975,0,0,0,96-96h32a32.00033,32.00033,0,0,0,32-32V256A31.99908,31.99908,0,0,0,576,224ZM96,384H64V256H96Zm416,32a64.18916,64.18916,0,0,1-64,64H192a64.18916,64.18916,0,0,1-64-64V192a63.99942,63.99942,0,0,1,64-64H448a63.99942,63.99942,0,0,1,64,64Zm64-32H544V256h32ZM416,192a64,64,0,1,0,64,64A64.07333,64.07333,0,0,0,416,192Zm0,96a32,32,0,1,1,32-32A31.97162,31.97162,0,0,1,416,288ZM384,416h64V384H384Zm-96,0h64V384H288ZM224,192a64,64,0,1,0,64,64A64.07333,64.07333,0,0,0,224,192Zm0,96a32,32,0,1,1,32-32A31.97162,31.97162,0,0,1,224,288Z" />
                  </svg>
                  <span className="sr-only">AI</span>
                </span>
              )}
              {recipe.tags.filter((t) => !HIDDEN_TAGS.has(t.toLowerCase())).map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
            <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>
            {recipe.description && (
              <p className="text-lg text-zinc-600 dark:text-zinc-400 leading-relaxed max-w-prose">{recipe.description}</p>
            )}

            <dl className="mt-5 flex flex-wrap gap-6 text-sm">
              {totalTime > 0 && (
                <div>
                  <dt className="font-semibold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">Total Time</dt>
                  <dd><time dateTime={`PT${totalTime}M`}>{totalTime} min</time></dd>
                </div>
              )}
              {recipe.prepTime != null && (
                <div>
                  <dt className="font-semibold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">Prep</dt>
                  <dd><time dateTime={`PT${recipe.prepTime}M`}>{recipe.prepTime} min</time></dd>
                </div>
              )}
              {recipe.cookTime != null && (
                <div>
                  <dt className="font-semibold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">Cook</dt>
                  <dd><time dateTime={`PT${recipe.cookTime}M`}>{recipe.cookTime} min</time></dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">Servings</dt>
                <dd>
                  <div className="flex items-center gap-2" aria-label="Adjust servings">
                    <button type="button" onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Decrease servings" className="w-7 h-7 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-lg leading-none">−</button>
                    <span className="tabular-nums font-bold w-5 text-center">{servings}</span>
                    <button type="button" onClick={() => setServings((s) => s + 1)} aria-label="Increase servings" className="w-7 h-7 border border-zinc-300 dark:border-zinc-600 flex items-center justify-center hover:bg-zinc-100 dark:hover:bg-zinc-800 text-lg leading-none">+</button>
                  </div>
                </dd>
              </div>
              {lastMadeAt && (
                <div>
                  <dt className="font-semibold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-0.5">Last Made</dt>
                  <dd><time dateTime={lastMadeAt}>{new Date(lastMadeAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}</time></dd>
                </div>
              )}
            </dl>

            {recipe.requiredCookware.length > 0 && (
              <div className="mt-5">
                <p className="font-semibold text-xs uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1">Cookware</p>
                <div className="flex flex-wrap gap-2">
                  {recipe.requiredCookware.map((c) => (
                    <span key={c} className="tag">
                      {c}{cookwareLookup[c] && <em className="font-normal"> by {cookwareLookup[c]}</em>}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </header>

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10">
            <section aria-labelledby="ingredients-heading">
              <h2 id="ingredients-heading" className="text-xl font-bold mb-4">Ingredients</h2>
              <ul role="list" className="space-y-2 legible">
                {recipe.ingredients.map((ing, idx) => {
                  const checked = checkedIngredients.has(idx);
                  const scaledQty = scaleQty(ing.quantity);
                  return (
                    <li key={idx}>
                      <label className="flex items-start gap-3 cursor-pointer group">
                        <input type="checkbox" checked={checked} onChange={() => toggleIngredient(idx)} aria-label={ing.ingredientName} className="mt-1 w-5 h-5 border-2 border-zinc-300 dark:border-zinc-600 accent-amber-500 shrink-0" />
                        <span className={checked ? 'line-through text-zinc-400 dark:text-zinc-600' : ''}>
                          {scaledQty != null && <span className="font-semibold tabular-nums">{scaledQty}{' '}</span>}
                          {ing.unit && <span>{ing.unit} </span>}
                          {ing.ingredientName}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section aria-labelledby="instructions-heading">
              <h2 id="instructions-heading" className="text-xl font-bold mb-4">Instructions</h2>
              <ol role="list" className="space-y-6 legible">
                {steps.map((step, idx) => (
                  <li key={idx} className="flex items-baseline gap-4">
                    <span className="shrink-0 w-8 text-right text-sm tabular-nums text-zinc-400 dark:text-zinc-500 select-none" aria-hidden="true">{idx + 1}.</span>
                    <p className="leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {subRecipes.length > 0 && (
            <section aria-labelledby="sub-recipes-heading" className="mt-12">
              <h2 id="sub-recipes-heading" className="text-xl font-bold mb-4">Made from Scratch</h2>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                {subRecipes.map((r) => (
                  <RecipeCard key={r.id} recipe={r} recipesBase={recipesBase} />
                ))}
              </div>
            </section>
          )}

          {(recipe.usedIn ?? []).length > 0 && (
            <section aria-labelledby="used-in-heading" className="mt-12">
              <h2 id="used-in-heading" className="text-xl font-bold mb-4">Made With This</h2>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
                {(recipe.usedIn ?? []).map((r) => (
                  <RecipeCard key={r.id} recipe={r} recipesBase={recipesBase} />
                ))}
              </div>
            </section>
          )}

          {recipe.sourceUrl && (
            <footer className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800">
              <a
                href={recipe.sourceUrl}
                target={`_${recipe.slug ?? recipe.id}`}
                rel="noopener noreferrer"
                className="text-sm text-amber-600 dark:text-amber-400 hover:underline"
              >
                View Original Recipe →
              </a>
            </footer>
          )}
        </article>
      </main>

      <aside className="no-print px-4 py-10 md:px-8 max-w-4xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-t border-b border-zinc-200 dark:border-zinc-800 mb-8">
          <section aria-labelledby="made-this-heading">
            <h2 id="made-this-heading" className="text-xl font-bold mb-3">I Made This</h2>
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              aria-busy={completing}
              aria-pressed={!!lastMadeAt}
              className="inline-flex items-center gap-2 btn-primary text-sm transition-colors"
            >
              {lastMadeAt ? <CheckCircle size={18} weight="fill" aria-hidden /> : <Circle size={18} aria-hidden />}
              {lastMadeAt ? 'I Made This Again' : 'I Made This'}
            </button>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">Mark this recipe as made to track when you last cooked it and update your pantry quantities.</p>
            {lastMadeAt && (isDev || (Date.now() - new Date(lastMadeAt).getTime()) > 7 * 24 * 60 * 60 * 1000) && (
              <p className="mt-2 text-xs italic text-zinc-500 dark:text-zinc-400">
                Last made on {new Date(lastMadeAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </section>

          <section aria-labelledby="feedback-heading">
            <h2 id="feedback-heading" className="text-xl font-bold mb-3">What'd you Think?</h2>
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-pressed={favorited}
              className={`inline-flex items-center gap-2 btn-secondary text-sm transition-colors ${favorited ? 'border-amber-500 text-amber-600 dark:text-amber-400' : ''}`}
            >
              {favorited ? <Heart size={18} weight="fill" aria-hidden /> : <Heart size={18} aria-hidden />}
              {favorited ? 'Favorited' : 'Add to Favorites'}
            </button>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">Save this recipe to your favorites so you can find it again later.</p>
          </section>

          <section aria-labelledby="share-heading">
            <h2 id="share-heading" className="text-xl font-bold mb-3">Share the Love</h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 btn-secondary text-sm"
            >
              <Printer size={18} aria-hidden />
              Print Recipe
            </button>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-3">Print this recipe to share with a friend or keep a copy for your kitchen.</p>
          </section>
        </div>

        {favoritedRecipes.length > 0 && (
          <div>
            <h2 className="text-xl font-bold mb-3">Your Favorites</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {favoritedRecipes.map((r) => (
                <RecipeCard key={r.id} recipe={r} recipesBase={recipesBase} />
              ))}
            </div>
          </div>
        )}
      </aside>

      {showPantryUpdate && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true" aria-label="Update pantry quantities">
          <div className="bg-white dark:bg-zinc-900 w-full sm:max-w-lg sm:rounded-lg max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
              <h2 className="font-bold text-lg">Update Pantry</h2>
              <button type="button" onClick={() => setShowPantryUpdate(false)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-1" aria-label="Close">
                <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="overflow-y-auto flex-1 divide-y divide-zinc-100 dark:divide-zinc-800">
              {pantryItems.map((item) => (
                <div key={item.id} className="flex items-center gap-3 px-4 py-2.5">
                  <span className="flex-1 text-sm truncate">{item.name}</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    defaultValue={item.quantity ?? 0}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setPantryEdits((prev) => {
                        const next = new Map(prev);
                        if (val === item.quantity) next.delete(item.id);
                        else next.set(item.id, isNaN(val) ? 0 : val);
                        return next;
                      });
                    }}
                    aria-label={`Quantity for ${item.name}`}
                    className="field-input w-20 text-right tabular-nums"
                  />
                  <span className="text-xs text-zinc-400 w-10">{item.unit ?? ''}</span>
                </div>
              ))}
              {pantryItems.length === 0 && (
                <p className="px-4 py-6 text-sm text-zinc-500 text-center">No pantry items with tracked quantities.</p>
              )}
            </div>
            <div className="flex gap-3 p-4 border-t border-zinc-200 dark:border-zinc-800 shrink-0">
              <button type="button" onClick={() => setShowPantryUpdate(false)} className="btn-secondary flex-1">Skip</button>
              <button
                type="button"
                onClick={handleSavePantry}
                disabled={savingPantry || pantryEdits.size === 0}
                aria-busy={savingPantry}
                className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {savingPantry ? 'Saving…' : `Save${pantryEdits.size > 0 ? ` (${pantryEdits.size})` : ''}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

