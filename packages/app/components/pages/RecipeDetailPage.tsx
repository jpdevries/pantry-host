import Head from 'next/head';
import { useRef, useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/router';
import { gql } from '@/lib/gql';
import { cacheSet, cacheGet } from '@pantry-host/shared/cache';
import { ArrowsOut, ArrowsIn, Trash, Heart, Printer, Circle, CheckCircle, CalendarPlus, LinkSimple, ForkKnife, ShareNetwork, Code, Rows, Columns, GridNine, Sun, Snowflake } from '@phosphor-icons/react';
import { enqueue } from '@/lib/offlineQueue';
import { useKitchen } from '@/lib/kitchen-context';
import RecipeCard from '@/components/RecipeCard';
import { Leaf } from '@phosphor-icons/react';
import { HIDDEN_TAGS, classifyRecipeCourse } from '@pantry-host/shared/constants';
import ResponsiveImage from '@/components/ResponsiveImage';
import { recipeToDataURI, imageToDataURI } from '@pantry-host/shared/export-recipe';
import { downloadCooklang, stepPhotoBaseUrl } from '@pantry-host/shared/cooklang';
import { hasCooklangSyntax, extractCooklang } from '@pantry-host/shared/cooklang-parser';
import PixabayImage from '@pantry-host/shared/components/PixabayImage';
import ImageBoundary from '@pantry-host/shared/components/ImageBoundary';
import Modal from '@pantry-host/shared/components/Modal';
import { NutritionSource } from '@pantry-host/shared/components/NutritionSource';
import { AllergensLine } from '@pantry-host/shared/components/AllergensLine';
import { getAllergenIcon } from '@pantry-host/shared/components/allergen-icons';
import { readFavorites, toggleFavorite } from '@pantry-host/shared/favorites';
import { groupIngredients } from '@pantry-host/shared/ingredient-groups';
import { resolveGroceryStatus, pantryIndex, findPantryItem } from '@pantry-host/shared/grocery-status';
import { isOwner } from '@/lib/isTrustedNetwork';
import { isBrowser } from '@pantry-host/shared/env';

interface RecipeIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  itemSize: number | null;
  itemSizeUnit: string | null;
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

export interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  instructions: string;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  tags: string[];
  requiredCookware: { id: string; name: string; brand: string | null }[];
  source: string;
  sourceUrl: string | null;
  photoUrl: string | null;
  stepPhotos: string[];
  lastMadeAt: string | null;
  queued: boolean;
  ingredients: RecipeIngredient[];
  /** Recursively-unfurled ingredient list — same shape as `ingredients`,
   *  but sub-recipes are expanded to their constituents. Used by the
   *  AllergensLine so warnings bubble up through the recipe chain. */
  groceryIngredients: Pick<RecipeIngredient, 'ingredientName' | 'quantity' | 'unit' | 'itemSize' | 'itemSizeUnit'>[];
  usedIn: SubRecipe[];
}

export const RECIPE_QUERY = `
  query Recipe($id: String!) {
    recipe(id: $id) {
      id slug title description instructions servings prepTime cookTime
      tags requiredCookware { id name brand } source sourceUrl photoUrl stepPhotos lastMadeAt queued
      ingredients { ingredientName quantity unit itemSize itemSizeUnit sourceRecipeId }
      groceryIngredients { ingredientName quantity unit itemSize itemSizeUnit }
      usedIn { id slug title cookTime prepTime servings source tags photoUrl queued }
    }
  }
`;

const DELETE_RECIPE = `mutation DeleteRecipe($id: String!) { deleteRecipe(id: $id) }`;
const COMPLETE_RECIPE = `mutation CompleteRecipe($id: String!, $servings: Int) { completeRecipe(id: $id, servings: $servings) { id lastMadeAt } }`;
const TOGGLE_QUEUED = `mutation ToggleQueued($id: String!) { toggleRecipeQueued(id: $id) { id queued } }`;
const PANTRY_QUERY = `query Ingredients($kitchenSlug: String) { ingredients(kitchenSlug: $kitchenSlug) { id name aliases quantity unit itemSize itemSizeUnit alwaysOnHand barcode productMeta } }`;
const UPDATE_INGREDIENT = `mutation UpdateIngredient($id: String!, $quantity: Float) { updateIngredient(id: $id, quantity: $quantity) { id quantity } }`;

// Intl.DateTimeFormat's ICU pattern cache blows Rex's V8 SSR isolate heap
// ("Fatal process out of memory: DateTimePatternGeneratorCache::CreateGenerator"),
// which kills the Rex process and truncates the response mid-body. Format
// dates deterministically without Intl so SSR stays within the isolate's budget.
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function formatMadeDate(iso: string, style: 'short' | 'long' = 'short'): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const months = style === 'short' ? MONTHS_SHORT : MONTHS_LONG;
  return `${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

// Structural-equality check used to bail out of `setRecipe()` when the
// post-hydration GraphQL refetch returns the same payload as the SSR seed
// (the common case). Without this gate the new object reference fires the
// `[recipe, …]` useEffects (sub-recipes fetch, pantry auto-check, photoUrl
// re-resolve, Pixabay key arrival → mount), each one a re-render and a
// visible flicker through PixabayImage's idle→loading→hit transitions.
// Stringify cost on a ~2 KB recipe payload is sub-ms and runs once per load.
function sameRecipe(a: Recipe | null, b: Recipe | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

interface PantryItem { id: string; name: string; aliases: string[] | null; quantity: number | null; unit: string | null; itemSize: number | null; itemSizeUnit: string | null; alwaysOnHand: boolean; barcode: string | null; productMeta: string | null; }

interface Props { recipeId: string; initialRecipe?: Recipe | null; }

/**
 * Per-season tag-chip metadata. `autumn` is mapped as a synonym
 * of `fall` so British/Commonwealth users get the same icon and
 * color when they tag a recipe their way. The display label is
 * always whatever the user typed (we just pick the icon + token
 * by lookup) — so a recipe tagged `autumn` shows "autumn" with
 * the fall-orange palette, not silently rewritten to "fall".
 */
const SEASON_META: Record<string, { Icon: React.ComponentType<{ size?: number; weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone'; 'aria-hidden'?: boolean }>; token: string }> = {
  spring: { Icon: SeedlingIcon, token: '--color-season-spring' },
  summer: { Icon: Sun, token: '--color-season-summer' },
  fall: { Icon: MapleLeafIcon, token: '--color-season-fall' },
  autumn: { Icon: MapleLeafIcon, token: '--color-season-fall' },
  winter: { Icon: Snowflake, token: '--color-season-winter' },
};
/** Tags that get the seasonal chip treatment. Added to the
 *  generic-tag exclusion filter so a styled chip + plain chip
 *  don't render twice. */
const SEASON_TAGS = new Set(Object.keys(SEASON_META));

const GRID_OPTIONS = [
  { cols: 3, Icon: GridNine, label: '3 columns' },
  { cols: 2, Icon: Columns, label: '2 columns' },
  { cols: 1, Icon: Rows, label: '1 column' },
] as const;

function StepPhotos({ steps, sourceUrl, dbStepPhotos }: { steps: string[]; sourceUrl: string | null | undefined; dbStepPhotos?: string[] }) {
  const [gridCols, setGridCols] = useState(3);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const errorCount = useRef(0);
  const hasDbPhotos = dbStepPhotos?.some((url) => url && url.length > 0);
  const base = !hasDbPhotos && sourceUrl ? stepPhotoBaseUrl(sourceUrl) : null;
  if (!hasDbPhotos && !base) return null;
  if (steps.length === 0) return null;

  return (
    <div className="mt-12" ref={wrapperRef}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold">Step by Step</h2>
        <div className="hidden md:flex items-center gap-1" role="radiogroup" aria-label="Grid columns">
          {GRID_OPTIONS.map(({ cols, Icon, label }) => (
            <button
              key={cols}
              type="button"
              onClick={() => setGridCols(cols)}
              aria-label={label}
              aria-pressed={gridCols === cols}
              className={`p-1.5 rounded transition-colors ${gridCols === cols ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'}`}
            >
              <Icon size={18} weight={gridCols === cols ? 'bold' : 'light'} aria-hidden />
            </button>
          ))}
        </div>
      </div>
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${gridCols}, 1fr)` }}>
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const dbPhoto = dbStepPhotos?.[i];
          const photoUrl = dbPhoto || (base ? `${encodeURI(base)}.${stepNum}.jpg` : null);
          if (!photoUrl) return null;
          return (
            <div key={stepNum} className="card overflow-hidden">
              <img
                src={photoUrl.startsWith('/uploads/') ? photoUrl.replace(/\.\w+$/, '-400.jpg') : photoUrl}
                alt={`Step ${stepNum}`}
                className="w-full aspect-[4/3] object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).closest('.card')!.style.display = 'none';
                  errorCount.current++;
                  if (errorCount.current >= steps.length && wrapperRef.current) {
                    wrapperRef.current.style.display = 'none';
                  }
                }}
              />
              <div className="p-3">
                <span className="text-xs font-bold text-[var(--color-text-secondary)]">Step {stepNum}</span>
                <p className="text-sm mt-1 line-clamp-3">{step}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RecipeDetailPage({ recipeId, initialRecipe }: Props) {
  const kitchen = useKitchen();
  const router = useRouter();
  const recipesBase = `/kitchens/${kitchen}/recipes`;

  const cacheKey = `cache:recipe:${recipeId}`;
  const cachedRecipe = isBrowser ? cacheGet<Recipe>(cacheKey) : null;
  const seedRecipe = initialRecipe ?? cachedRecipe;
  const [recipe, setRecipe] = useState<Recipe | null>(seedRecipe);
  const [notFound, setNotFound] = useState(false);
  const [owner, setOwner] = useState(false);
  const [lanIP, setLanIP] = useState<string | null>(null);
  const [guestLinkCopied, setGuestLinkCopied] = useState(false);
  const [menus, setMenus] = useState<{ id: string; slug: string; title: string; category: string | null; recipeIds: string[] }[]>([]);
  const [menuSelections, setMenuSelections] = useState<Record<string, boolean>>({});
  const [savingMenus, setSavingMenus] = useState(false);
  const [menuStatus, setMenuStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [ageVerified, setAgeVerified] = useState(() => {
    if (isBrowser) return localStorage.getItem('age-verified') === 'true';
    return false;
  });
  // recipe-api.com key for the NutritionFacts display block. Only fetched
  // for owner (loopback / HTTPS) — guests get null and the block hides itself.
  const [recipeApiKey, setRecipeApiKey] = useState<string | null>(null);
  const [copiedUri, setCopiedUri] = useState(false);
  useEffect(() => {
    fetch('/api/recipe-api-key')
      .then((r) => (r.ok ? r.json() : { key: null }))
      .then((d: { key: string | null }) => setRecipeApiKey(d.key))
      .catch(() => setRecipeApiKey(null));
  }, []);

  // Pixabay fallback for hero image on recipes without their own photo.
  const [pixabayKey, setPixabayKey] = useState<string | null>(null);
  const [pixabayEnabled, setPixabayEnabled] = useState(false);
  useEffect(() => {
    fetch('/api/settings-read')
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { values?: Record<string, string | null> } | null) => {
        if (d?.values?.PIXABAY_FALLBACK_ENABLED === 'true' && d.values.PIXABAY_API_KEY) {
          setPixabayEnabled(true);
          fetch('/api/settings-read?reveal=PIXABAY_API_KEY')
            .then((r) => (r.ok ? r.json() : null))
            .then((r: { value?: string | null } | null) => setPixabayKey(r?.value ?? null))
            .catch(() => {});
        }
      })
      .catch(() => {});
  }, []);

  const articleRef = useRef<HTMLElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [servings, setServings] = useState(seedRecipe?.servings ?? 2);

  // Pantry snapshot for auto-check. Fetched once on mount in parallel
  // with the recipe; the merge effect below initializes checkboxes for
  // ingredients that resolveGroceryStatus() calls 'have'. Also used later
  // by the "Update Pantry" modal on complete.
  const [pantry, setPantry] = useState<PantryItem[] | null>(null);
  const pantryAutoCheckedRef = useRef(false);

  const [subRecipes, setSubRecipes] = useState<SubRecipe[]>([]);

  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [lastMadeAt, setLastMadeAt] = useState<string | null>(seedRecipe?.lastMadeAt ?? null);
  const [queued, setQueued] = useState(seedRecipe?.queued ?? false);
  const [togglingQueue, setTogglingQueue] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favoritedRecipes, setFavoritedRecipes] = useState<SubRecipe[]>([]);
  const [showPantryUpdate, setShowPantryUpdate] = useState(false);
  const [pantryItems, setPantryItems] = useState<PantryItem[]>([]);
  const [pantryEdits, setPantryEdits] = useState<Map<string, number>>(new Map());
  const [savingPantry, setSavingPantry] = useState(false);
  const [exportPhotoUrl, setExportPhotoUrl] = useState<string | null>(null);

  // Resolve local upload photos to base64 data URIs for export
  useEffect(() => {
    if (!recipe?.photoUrl) { setExportPhotoUrl(null); return; }
    if (!recipe.photoUrl.startsWith('/uploads/')) {
      setExportPhotoUrl(recipe.photoUrl);
      return;
    }
    const uuid = recipe.photoUrl.replace(/^\/uploads\//, '').replace(/\.\w+$/, '');
    imageToDataURI(`/uploads/${uuid}-400.jpg`)
      .then(setExportPhotoUrl)
      .catch(() => setExportPhotoUrl(null));
  }, [recipe?.photoUrl]);

  // Client-side feature detection
  useEffect(() => {
    setOwner(isOwner());
    setSupportsFullscreen(Boolean(document.documentElement.requestFullscreen || (document.documentElement as any).webkitRequestFullscreen));

    // Fetch LAN IP for guest link (owner only).
    // Reads from a static JSON file generated at build/start time.
    if (isOwner()) {
      fetch('/network-info.json').then(r => r.json()).then(d => { if (d.hostname || d.ip) setLanIP(d.hostname || d.ip); }).catch(() => {});

      // Fetch menus for "Add to a Menu" section
      gql<{ menus: { id: string; slug: string; title: string; category: string | null; recipes: { recipe: { id: string } }[] }[] }>(
        `{ menus { id slug title category recipes { recipe { id } } } }`
      ).then(data => {
        const mapped = data.menus.map(m => ({ id: m.id, slug: m.slug, title: m.title, category: m.category, recipeIds: m.recipes.map(r => r.recipe.id) }));
        setMenus(mapped);
      }).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!recipeId) return;
    setFavorited(readFavorites().includes(recipeId));
  }, [recipeId]);

  // Fetch favorited recipes for the aside grid
  useEffect(() => {
    const others = readFavorites().filter((id) => id !== recipeId);
    if (others.length === 0) { setFavoritedRecipes([]); return; }
    Promise.all(
      others.slice(0, 4).map((id) =>
        gql<{ recipe: SubRecipe | null }>(
          `query FavRecipe($id: String!) { recipe(id: $id) { id slug title cookTime prepTime servings source tags photoUrl queued } }`,
          { id },
        ).then((d) => d.recipe).catch(() => null),
      ),
    ).then((results) => setFavoritedRecipes(results.filter((r): r is SubRecipe => r != null)));
  }, [favorited, recipeId]);

  function handleToggleFavorite() {
    const next = toggleFavorite(recipeId);
    setFavorited(next.includes(recipeId));
  }

  // Pantry fetch for ingredient auto-check. Runs in parallel with the
  // recipe load; the merge effect below reads both when ready.
  useEffect(() => {
    gql<{ ingredients: PantryItem[] }>(PANTRY_QUERY, { kitchenSlug: kitchen })
      .then((d) => setPantry(d.ingredients ?? []))
      .catch((err) => { console.warn('[pantry fetch]', err); setPantry([]); });
  }, [kitchen]);

  // One-shot: when both recipe + pantry are loaded, auto-check ingredients
  // that resolve to 'have'. Guarded by a ref so the merge happens exactly
  // once per recipe — user unchecks are preserved against subsequent
  // pantry refetches (e.g., after completing the recipe).
  useEffect(() => {
    if (!recipe || pantry === null || pantryAutoCheckedRef.current) return;
    if (pantry.length === 0 || recipe.ingredients.length === 0) {
      pantryAutoCheckedRef.current = true;
      return;
    }
    const index = pantryIndex(pantry);
    const autoChecked = new Set<number>();
    recipe.ingredients.forEach((ing, i) => {
      const match = findPantryItem(index, ing.ingredientName);
      if (resolveGroceryStatus(match, ing) === 'have') autoChecked.add(i);
    });
    pantryAutoCheckedRef.current = true;
    if (autoChecked.size === 0) return;
    setCheckedIngredients((prev) => {
      const merged = new Set(prev);
      for (const i of autoChecked) merged.add(i);
      return merged;
    });
  }, [recipe, pantry]);

  useEffect(() => {
    if (!recipeId) return;
    gql<{ recipe: Recipe | null }>(RECIPE_QUERY, { id: recipeId })
      .then((d) => {
        if (!d.recipe) { setNotFound(true); return; }
        const fresh = d.recipe;
        // Bail out at the setter level when the refetch matches the seed.
        // React skips the re-render when the updater returns reference-equal
        // state, so downstream `[recipe, …]` effects don't re-fire.
        setRecipe((prev) => sameRecipe(prev, fresh) ? prev : fresh);
        const nextServings = fresh.servings ?? 2;
        setServings((prev) => prev === nextServings ? prev : nextServings);
        setLastMadeAt((prev) => prev === fresh.lastMadeAt ? prev : fresh.lastMadeAt);
        setQueued((prev) => prev === fresh.queued ? prev : fresh.queued);
        cacheSet(cacheKey, fresh);
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

  // Runtime Cooklang: if instructions contain .cook syntax, parse it
  // live for display. The raw syntax stays in the DB for round-trip
  // editing; we just strip it here for readability.
  const rawInstructions = recipe?.instructions ?? '';
  const isCooklang = hasCooklangSyntax(rawInstructions);
  const cooklangData = isCooklang ? extractCooklang(rawInstructions) : null;
  const displayInstructions = cooklangData?.cleanedText ?? rawInstructions;
  const steps = displayInstructions
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

  async function handleSaveMenus(e: React.FormEvent) {
    e.preventDefault();
    if (!recipe) return;
    setSavingMenus(true);
    const course = classifyRecipeCourse(recipe.tags);
    try {
      for (const [menuId, shouldBeIn] of Object.entries(menuSelections)) {
        const menu = menus.find(m => m.id === menuId);
        if (!menu) continue;
        const isIn = menu.recipeIds.includes(recipe.id);
        if (shouldBeIn === isIn) continue; // No change needed
        await gql(`mutation($menuId:String!,$recipeId:String!,$course:String){toggleRecipeInMenu(menuId:$menuId,recipeId:$recipeId,course:$course){id}}`, { menuId, recipeId: recipe.id, course });
      }
      // Update local state to reflect changes
      setMenus((prev) => prev.map(m => {
        const sel = menuSelections[m.id];
        if (sel === undefined) return m;
        const isIn = m.recipeIds.includes(recipe.id);
        if (sel && !isIn) return { ...m, recipeIds: [...m.recipeIds, recipe.id] };
        if (!sel && isIn) return { ...m, recipeIds: m.recipeIds.filter(id => id !== recipe.id) };
        return m;
      }));
      setMenuSelections({});
      setMenuStatus({ type: 'success', message: 'Your menus have been updated.' });
      setTimeout(() => setMenuStatus(null), 5000);
    } catch {
      setMenuStatus({ type: 'error', message: 'Failed to update menus. Please try again.' });
    } finally {
      setSavingMenus(false);
    }
  }

  async function handleDelete() {
    if (!recipe) return;
    setDeleting(true);
    try {
      await gql(DELETE_RECIPE, { id: recipe.id });
      // Full page load (not router.push) so the _app hash-scroll
      // workaround fires on mount and scrolls past the nav to #stage.
      window.location.href = `${recipesBase}#stage`;
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
      <main id="stage" className="max-sm:min-h-screen px-4 py-10 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Recipe not found</h1>
          <a href={`${recipesBase}#stage`} className="text-accent hover:underline">← Back to Recipes</a>
        </div>
      </main>
    );
  }

  if (!recipe) {
    return <main id="stage" className="max-sm:min-h-screen" aria-busy="true" />;
  }

  const isAdult = recipe.tags.some((t) => ['420', 'cannabis', 'adult-only'].includes(t.toLowerCase()));
  const isGlutenFree = recipe.tags.some((t) => t.toLowerCase() === 'gluten-free');
  const isCannabis = isAdult;
  const isSustainable = recipe.tags.some((t) => ['sustainable', 'local'].includes(t.toLowerCase()));
  const isBreastfeedingSafe = recipe.tags.some((t) => t.toLowerCase() === 'breastfeeding-safe');
  const isLactation = recipe.tags.some((t) => t.toLowerCase() === 'lactation');
  const isBreastfeedingAlert = recipe.tags.some((t) => t.toLowerCase() === 'breastfeeding-alert');
  const isPregnancySafe = recipe.tags.some((t) => t.toLowerCase() === 'pregnancy-safe');
  const isPescatarian = recipe.tags.some((t) => t.toLowerCase() === 'pescatarian');
  const isVegetarian = recipe.tags.some((t) => t.toLowerCase() === 'vegetarian');
  const isVegan = recipe.tags.some((t) => t.toLowerCase() === 'vegan');
  // Allergen warning tags — render with the same amber chip treatment as
  // breastfeeding-alert. Substance label = strip the "contains-" prefix.
  const allergenTags = recipe.tags.filter((t) => t.toLowerCase().startsWith('contains-'));

  if (isAdult && !ageVerified) {
    return (
      <main id="stage" className="max-sm:min-h-screen px-4 py-10 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <h1 className="text-2xl font-bold mb-3">Age Verification Required</h1>
          <p className="text-[var(--color-text-secondary)] mb-6 pretty">This recipe contains adult-only content. You must be 21 or older to view it.</p>
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

      <main id="stage" className="max-sm:min-h-screen">
        <div className="no-print px-4 py-4 md:px-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b max-w-5xl mx-auto" style={{ borderColor: 'var(--color-accent-subtle)' }}>
          <a href={`${recipesBase}#stage`} className="text-sm text-[var(--color-text-secondary)] hover:text-accent transition-colors">← Recipes</a>
          <div className="flex items-center gap-3 flex-wrap justify-end">
            <button
              type="button"
              onClick={handleToggleQueue}
              disabled={togglingQueue}
              aria-pressed={queued}
              aria-label={queued ? 'Remove from grocery list' : 'Add to grocery list'}
              className={`btn-secondary text-sm transition-colors ${queued ? 'border-accent text-accent' : ''}`}
            >
              {queued ? '✓ On List' : '+ Grocery List'}
            </button>
            <a href={`${recipesBase}/${recipe.slug ?? recipe.id}/edit#stage`} className="btn-secondary text-sm">Edit</a>
            {deleteConfirm ? (
              <div className="flex gap-2 items-center">
                <span className="text-sm text-[var(--color-text-secondary)]">Delete?</span>
                <button type="button" autoFocus onClick={handleDelete} disabled={deleting} aria-label="Confirm delete" className="btn-danger text-sm">{deleting ? 'Deleting…' : 'Yes'}</button>
                <button type="button" onClick={() => setDeleteConfirm(false)} className="btn-secondary text-sm">No</button>
              </div>
            ) : (
              <button type="button" onClick={() => setDeleteConfirm(true)} aria-label="Delete recipe" className="btn-secondary btn-delete p-2">
                <Trash size={16} aria-hidden />
              </button>
            )}
            {supportsFullscreen && (
              <button type="button" onClick={isFullscreen ? exitZen : enterZen} aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'} aria-pressed={isFullscreen} className="btn-secondary p-2">
                {isFullscreen ? <ArrowsIn size={18} aria-hidden /> : <ArrowsOut size={18} aria-hidden />}
              </button>
            )}
          </div>
        </div>

        <article ref={articleRef} className="px-4 py-8 md:px-8 max-w-4xl mx-auto" aria-label={recipe.title}>
          <button
            type="button"
            onClick={exitZen}
            aria-label="Exit full screen"
            className="zen-exit-btn fixed top-4 right-4 z-50 bg-[rgba(0,0,0,0.7)] hover:bg-[rgba(0,0,0,0.9)] text-white p-2 rounded-full backdrop-blur transition-colors hidden outline outline-1 outline-current"
          >
            <ArrowsIn size={18} aria-hidden />
          </button>
          <ImageBoundary alt={recipe.title}>
            {recipe.photoUrl ? (
              <div className="mb-8 aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
                <ResponsiveImage
                  src={recipe.photoUrl}
                  alt={recipe.title}
                  className="w-full h-full object-cover"
                  loading="eager"
                  sizes="(min-width: 896px) 896px, 100vw"
                />
              </div>
            ) : pixabayEnabled && pixabayKey ? (
              // Reserve the same aspect-[16/9] card-bg box as the photoUrl branch so the
              // hero area stays stable while PixabayImage cycles idle → loading → hit/miss.
              // PixabayImage with `hidePlaceholder` returns null in idle/loading/miss, so
              // without this wrapper the hero box collapses to 0px and snaps open when the
              // photo arrives — a visible flash of "no image" that pushes the rest of the
              // page down. The wrapper is also the skeleton when Pixabay returns a miss
              // (no match / rate-limit / bad key) — empty card-bg is preferable to the
              // page collapsing.
              <div className="mb-8 aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
                <PixabayImage recipe={{ id: recipe.id, title: recipe.title }} apiKey={pixabayKey} alt={recipe.title} hidePlaceholder />
              </div>
            ) : null}
          </ImageBoundary>

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
              {isGlutenFree && (
                <span className="tag inline-flex items-center gap-1 text-green-600 dark:text-green-400" title="Gluten-free">
                  <WheatIcon />
                  gluten-free
                </span>
              )}
              {isCannabis && (
                <span className="tag inline-flex items-center gap-1 text-green-600 dark:text-green-400" title="Contains cannabis">
                  <CannabisIcon />
                  420
                </span>
              )}
              {isSustainable && (
                <span className="tag inline-flex items-center gap-1 text-green-600 dark:text-green-400" title="Locally sourced">
                  <Leaf size={14} aria-hidden />
                  sustainable
                </span>
              )}
              {isBreastfeedingSafe && (
                <span className="tag inline-flex items-center gap-1 text-teal-600 dark:text-teal-400" title="Breastfeeding safe">
                  <ShieldCheckIcon />
                  breastfeeding-safe
                </span>
              )}
              {isLactation && (
                <span className="tag inline-flex items-center gap-1 text-teal-600 dark:text-teal-400" title="Supports lactation">
                  <TintIcon />
                  lactation
                </span>
              )}
              {isBreastfeedingAlert && (
                <span className="tag inline-flex items-center gap-1" style={{ color: 'var(--color-warning)' }} title="Breastfeeding caution">
                  <ExclamationTriangleIcon />
                  breastfeeding-alert
                </span>
              )}
              {allergenTags.map((t) => {
                const substance = t.replace(/^contains-/i, '').replace(/-/g, ' ');
                const Icon = getAllergenIcon(substance);
                return (
                  <span
                    key={t}
                    className="tag inline-flex items-center gap-1"
                    style={{ color: 'var(--color-warning)' }}
                    title={`Contains ${substance}`}
                  >
                    <Icon size={12} aria-hidden weight="bold" />
                    {t}
                  </span>
                );
              })}
              {isPregnancySafe && (
                <span className="tag inline-flex items-center gap-1 text-pink-600 dark:text-pink-400" title="Pregnancy safe">
                  <HeartIcon />
                  pregnancy-safe
                </span>
              )}
              {isPescatarian && (
                <span className="tag inline-flex items-center gap-1 text-sky-600 dark:text-sky-400" title="Pescatarian">
                  <FishIcon />
                  pescatarian
                </span>
              )}
              {isVegetarian && (
                <span className="tag inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Vegetarian">
                  <CarrotIcon />
                  vegetarian
                </span>
              )}
              {isVegan && (
                <span className="tag inline-flex items-center gap-1" style={{ color: 'var(--color-diet-vegan)' }} title="Vegan">
                  <LeafIcon />
                  vegan
                </span>
              )}
              {/* Seasonal tags get a per-season chip palette + Phosphor
                  icon. `autumn` and `fall` collapse to the same fall
                  treatment. Display preserves the original tag string. */}
              {recipe.tags.filter((t) => SEASON_TAGS.has(t.toLowerCase())).map((t) => {
                const { Icon, token } = SEASON_META[t.toLowerCase()];
                return (
                  <span key={t} className="tag inline-flex items-center gap-1" style={{ color: `var(${token})` }} title={t.charAt(0).toUpperCase() + t.slice(1)}>
                    <Icon size={12} weight="bold" aria-hidden />
                    {t}
                  </span>
                );
              })}
              {recipe.tags.filter((t) => !HIDDEN_TAGS.has(t.toLowerCase()) && !t.toLowerCase().startsWith('contains-') && !SEASON_TAGS.has(t.toLowerCase()) && !['gluten-free', '420', 'cannabis', 'adult-only', 'sustainable', 'local', 'breastfeeding-safe', 'lactation', 'breastfeeding-alert', 'pregnancy-safe', 'pescatarian', 'vegetarian', 'vegan'].includes(t.toLowerCase())).map((t) => <span key={t} className="tag">{t}</span>)}
            </div>
            <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>
            {recipe.description && (
              <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed max-w-prose whitespace-pre-line">{recipe.description.split(/(https?:\/\/\S+)/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline hover:text-accent">{part.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a> : part)}</p>
            )}

            <dl className="mt-5 flex flex-wrap gap-6 text-sm">
              {totalTime > 0 && (
                <div>
                  <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Total Time</dt>
                  <dd><time dateTime={`PT${totalTime}M`}>{totalTime} min</time></dd>
                </div>
              )}
              {recipe.prepTime != null && (
                <div>
                  <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Prep</dt>
                  <dd><time dateTime={`PT${recipe.prepTime}M`}>{recipe.prepTime} min</time></dd>
                </div>
              )}
              {recipe.cookTime != null && (
                <div>
                  <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Cook</dt>
                  <dd><time dateTime={`PT${recipe.cookTime}M`}>{recipe.cookTime} min</time></dd>
                </div>
              )}
              <div>
                <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Servings</dt>
                <dd>
                  <div className="flex items-center gap-2" aria-label="Adjust servings">
                    <button type="button" onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Decrease servings" className="w-7 h-7 border border-[var(--color-border-card)] flex items-center justify-center hover:bg-[var(--color-accent-subtle)] text-lg leading-none">−</button>
                    <span className="tabular-nums font-bold w-5 text-center">{servings}</span>
                    <button type="button" onClick={() => setServings((s) => s + 1)} aria-label="Increase servings" className="w-7 h-7 border border-[var(--color-border-card)] flex items-center justify-center hover:bg-[var(--color-accent-subtle)] text-lg leading-none">+</button>
                  </div>
                </dd>
              </div>
              {lastMadeAt && (
                <div>
                  <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Last Made</dt>
                  <dd><time dateTime={lastMadeAt}>{formatMadeDate(lastMadeAt)}</time></dd>
                </div>
              )}
            </dl>

            {recipe.requiredCookware.length > 0 && (
              <div className="mt-5">
                <p className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">Cookware</p>
                <div className="flex flex-wrap gap-2">
                  {recipe.requiredCookware.map((cw) => (
                    <a key={cw.id} href={`/kitchens/${kitchen}/cookware/${cw.id}#stage`} className="tag hover:underline">
                      {cw.name}{cw.brand && cw.brand !== cw.name && <em className="font-normal"> by {cw.brand}</em>}
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Source */}
            {recipe.sourceUrl && (
              <p className="mt-4 text-xs text-[var(--color-text-secondary)] overflow-hidden">
                {recipe.sourceUrl.startsWith('at://') ? (
                  <span className="flex items-baseline gap-2 max-w-full overflow-hidden">
                    <span className="shrink-0">Source:</span>
                    <button type="button" onClick={() => { navigator.clipboard.writeText(recipe.sourceUrl!); setCopiedUri(true); setTimeout(() => setCopiedUri(false), 2000); }} title="Copy AT URI" className="font-mono text-[10px] min-w-0 truncate hover:underline cursor-copy">{recipe.sourceUrl}</button>
                    <span aria-live="polite" className="shrink-0 text-[10px]">{copiedUri ? '✓ Copied' : ''}</span>
                  </span>
                ) : (
                  <>Source: <a href={recipe.sourceUrl} target={`_${recipe.slug ?? recipe.id}`} rel="noopener noreferrer" className="underline">{(() => { try { return new URL(recipe.sourceUrl).hostname; } catch { return recipe.sourceUrl; } })()}</a></>
                )}
              </p>
            )}
          </header>

          {/* Allergens — unions `contains-*` recipe tags with pantry OFF
              metadata. Uses `groceryIngredients` so warnings bubble up
              through sub-recipes (e.g. an "Almond Milk" sub-recipe's
              almonds surface "Nuts" on the parent recipe). Sits above
              Ingredients so the warning is seen before any cooking
              decisions. */}
          <AllergensLine
            ingredients={recipe.groceryIngredients}
            pantry={pantry ?? []}
            recipeTags={recipe.tags}
          />

          <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10">
            <section aria-labelledby="ingredients-heading">
              <h2 id="ingredients-heading" className="text-xl font-bold mb-4">Ingredients</h2>
              <div className="space-y-4 legible">
                {groupIngredients(recipe.ingredients).map((g, gi) => {
                  const items = (
                    <ul role="list" className="space-y-2">
                      {g.items.map((ing) => {
                        const checked = checkedIngredients.has(ing.index);
                        const scaledQty = scaleQty(ing.quantity);
                        // When item_size is set, display as "{qty} {item_size}{item_size_unit} {name}"
                        // e.g. "2 16oz pepper steak". Scaling scales qty only; item_size is preserved.
                        const hasItemSize = ing.itemSize != null;
                        return (
                          <li key={ing.index}>
                            <label className="flex items-start gap-3 cursor-pointer group">
                              <input type="checkbox" checked={checked} onChange={() => toggleIngredient(ing.index)} aria-label={ing.ingredientName} className="mt-1 w-5 h-5 border-2 border-[var(--color-border-card)] accent-accent shrink-0" />
                              {/* No line-through when checked — keep ingredient text legible
                                  while cooking whether or not it's been collected. The checkbox
                                  state alone communicates "have it / done with this step." */}
                              <span className={checked ? 'text-[var(--color-text-secondary)]' : ''}>
                                {scaledQty != null && <span className="font-semibold tabular-nums">{scaledQty}{' '}</span>}
                                {hasItemSize && (
                                  <span className="tabular-nums">{ing.itemSize}{ing.itemSizeUnit ?? ''} </span>
                                )}
                                {!hasItemSize && ing.unit && <span>{ing.unit} </span>}
                                {ing.ingredientName}
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  );
                  if (!g.group) return <div key={`g-${gi}`}>{items}</div>;
                  return (
                    <fieldset key={g.group} className="mt-4 first:mt-0">
                      <legend className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">{g.group}</legend>
                      {items}
                    </fieldset>
                  );
                })}
              </div>
            </section>

            <section aria-labelledby="instructions-heading">
              <h2 id="instructions-heading" className="text-xl font-bold mb-4">Instructions</h2>
              <ol role="list" className="space-y-3 legible">
                {steps.map((step, idx) => (
                  <li key={idx} className="flex items-baseline gap-4">
                    <span className="shrink-0 w-8 text-right text-sm tabular-nums text-[var(--color-text-secondary)] select-none" aria-hidden="true">{idx + 1}.</span>
                    <p className="leading-relaxed">{step}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          <StepPhotos steps={steps} sourceUrl={recipe.sourceUrl} dbStepPhotos={recipe.stepPhotos} />

          {/* Nutrition panel — recipe-api.com import wins when available,
              otherwise aggregated from pantry OFF metadata where possible.
              Hidden silently when neither source has usable data. */}
          <NutritionSource
            sourceUrl={recipe.sourceUrl}
            recipeApiKey={recipeApiKey}
            ingredients={recipe.ingredients}
            pantry={pantry ?? []}
            servings={recipe.servings}
          />

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

        </article>
      </main>

      <aside className="no-print pt-10 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 border-t border-b md:text-center" style={{ borderColor: 'var(--color-accent-subtle)' }}>
          <section aria-labelledby="made-this-heading">
            <h2 id="made-this-heading" className="text-xl font-bold mb-3">I Made This</h2>
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              aria-busy={completing}
              aria-pressed={!!lastMadeAt}
              className="inline-flex items-center gap-2 btn-secondary text-sm transition-colors"
            >
              {lastMadeAt ? <CheckCircle size={18} weight="fill" aria-hidden /> : <Circle size={18} aria-hidden />}
              {lastMadeAt ? 'I Made This Again' : 'I Made This'}
            </button>
            <p className="text-sm text-[var(--color-text-secondary)] mt-3">Mark this recipe as made to track when you last cooked it and update your pantry quantities.</p>
            {lastMadeAt && (owner || (Date.now() - new Date(lastMadeAt).getTime()) > 7 * 24 * 60 * 60 * 1000) && (
              <p className="mt-2 text-xs italic text-[var(--color-text-secondary)]">
                Last made on {formatMadeDate(lastMadeAt, 'long')}
              </p>
            )}
          </section>

          <section aria-labelledby="queue-heading">
            <h2 id="queue-heading" className="text-xl font-bold mb-3">Add it to the List</h2>
            <button
              type="button"
              onClick={handleToggleQueue}
              disabled={togglingQueue}
              aria-pressed={queued}
              aria-label={queued ? 'Remove from grocery list' : 'Add to grocery list'}
              className={`btn-primary text-sm transition-colors ${queued ? 'border-accent text-accent' : ''}`}
            >
              {queued ? '✓ On List' : '+ Grocery List'}
            </button>
            <p className="text-sm text-[var(--color-text-secondary)] mt-3">Add ingredients for this recipe to your grocery list.</p>
          </section>

          <section aria-labelledby="feedback-heading">
            <h2 id="feedback-heading" className="text-xl font-bold mb-3">What'd you Think?</h2>
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-pressed={favorited}
              className={`inline-flex items-center gap-2 btn-secondary text-sm transition-colors ${favorited ? 'border-accent text-accent' : ''}`}
            >
              {favorited ? <Heart size={18} weight="fill" aria-hidden /> : <Heart size={18} aria-hidden />}
              {favorited ? 'Favorited' : 'Add to Favorites'}
            </button>
            <p className="text-sm text-[var(--color-text-secondary)] mt-3">Save this recipe to your favorites so you can find it again later.</p>
          </section>
        </div>

        {favoritedRecipes.length > 0 && (
          <div className="mt-10">
            <h2 className="text-xl font-bold mb-3">Your Favorites</h2>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
              {favoritedRecipes.map((r) => (
                <RecipeCard key={r.id} recipe={r} recipesBase={recipesBase} />
              ))}
            </div>
          </div>
        )}

        <div className="py-16 no-print">
          <div className="flex justify-center mb-3 opacity-60"><ShareNetwork size={24} weight="light" aria-hidden /></div>
          <h2 id="share-heading" className="text-xl font-bold mb-3 md:text-center">Share {recipe.title}</h2>
          <p className="text-sm text-[var(--color-text-secondary)] mb-10 md:text-center very legible pretty md:mx-auto">Print this recipe, export it as HTML to share with a friend, or add it to your calendar for meal planning.</p>
          <div className="flex flex-wrap gap-2 justify-center">
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center gap-2 btn-secondary text-sm"
            >
              <Printer size={18} aria-hidden />
              Print Recipe
            </button>
            <a
              href={recipeToDataURI({ ...recipe, requiredCookware: recipe.requiredCookware.map((c) => c.name).filter(Boolean), photoUrl: exportPhotoUrl })}
              download={`${recipe.slug || 'recipe'}.html`}
              className="flex items-center gap-2 btn-secondary text-sm"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width={18} height={18} fill="currentColor" aria-hidden="true">
                <path d="M567.31 283.89l-71.78-68.16c-8.28-7.8-20.41-9.88-30.84-5.38-10.31 4.42-16.69 13.98-16.69 24.97V288h-64V131.97c0-12.7-5.1-25-14.1-33.99L286.02 14.1c-9-9-21.2-14.1-33.89-14.1H47.99C21.5.1 0 21.6 0 48.09v415.92C0 490.5 21.5 512 47.99 512h288.02c26.49 0 47.99-21.5 47.99-47.99V352h-31.99v112.01c0 8.8-7.2 16-16 16H47.99c-8.8 0-16-7.2-16-16V48.09c0-8.8 7.2-16.09 16-16.09h176.04v104.07c0 13.3 10.7 23.93 24 23.93h103.98v128H168c-4.42 0-8 3.58-8 8v16c0 4.42 3.58 8 8 8h280v52.67c0 10.98 6.38 20.55 16.69 24.97 14.93 6.45 26.88-1.61 30.88-5.39l71.72-68.12c5.62-5.33 8.72-12.48 8.72-20.12s-3.1-14.81-8.7-20.12zM256.03 128.07V32.59c2.8.7 5.3 2.1 7.4 4.2l83.88 83.88c2.1 2.1 3.5 4.6 4.2 7.4h-95.48zM480 362.88V245.12L542 304l-62 58.88z" />
              </svg>
              Export HTML
            </a>
            <a
              href={`/api/recipe-ics?slug=${recipe.slug}`}
              download={`${recipe.slug || 'recipe'}.ics`}
              className="flex items-center gap-2 btn-secondary text-sm"
              onClick={(e) => {
                // iOS Safari can't download ICS files. Use webcal:// protocol
                // which triggers the native Calendar app directly.
                if (/iPad|iPhone|iPod/.test(navigator.userAgent)) {
                  e.preventDefault();
                  const url = new URL(`/api/recipe-ics?slug=${recipe.slug}`, window.location.origin);
                  url.protocol = window.location.protocol === 'https:' ? 'webcals:' : 'webcal:';
                  window.location.href = url.toString();
                }
              }}
            >
              <CalendarPlus size={18} aria-hidden />
              Add to Calendar
            </a>
            <button
              type="button"
              onClick={() => downloadCooklang({
                title: recipe.title,
                description: recipe.description,
                instructions: recipe.instructions,
                servings: recipe.servings,
                prepTime: recipe.prepTime,
                cookTime: recipe.cookTime,
                tags: recipe.tags,
                sourceUrl: recipe.sourceUrl,
                ingredients: recipe.ingredients?.map((i: { ingredientName: string; quantity?: number | null; unit?: string | null }) => ({
                  ingredientName: i.ingredientName,
                  quantity: i.quantity,
                  unit: i.unit,
                })),
              }, recipe.slug)}
              className="flex items-center gap-2 btn-secondary text-sm"
            >
              <Code size={18} aria-hidden />
              Export .cook
            </button>
            {lanIP && (
              <button
                type="button"
                onClick={() => {
                  const guestUrl = `http://${lanIP}:3000${window.location.pathname}`;
                  navigator.clipboard.writeText(guestUrl).then(() => {
                    setGuestLinkCopied(true);
                    setTimeout(() => setGuestLinkCopied(false), 2000);
                  }).catch(() => {
                    // Clipboard denied (e.g. iframe, non-secure context) — prompt to copy manually
                    window.prompt('Copy this guest link:', guestUrl);
                  });
                }}
                className="flex items-center gap-2 btn-secondary text-sm"
              >
                <LinkSimple size={18} aria-hidden />
                {guestLinkCopied ? 'Copied!' : 'Copy Guest Link'}
              </button>
            )}
          </div>
        </div>

        <hr style={{ borderColor: 'var(--color-border-card)' }} />

        {owner && menus.length > 0 && recipe && (() => {
          // Ordered buckets: menus matching these slugs/titles show in this order.
          // Anything not matched goes in "Show all menus" details.
          const KNOWN_ORDER = [
            // Row 1: special
            'baby', 'social',
            // Row 2: categories
            'todays-specials', 'daily', 'this-week',
            // Row 3: meals
            'breakfast', 'lunch', 'dinner', 'dessert',
            // Row 4: courses
            'appetizer', 'main-course', 'side', 'beverage',
            // Row 5: days
            'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
          ];
          const slugLower = (m: typeof menus[number]) => m.slug?.toLowerCase() || m.title.toLowerCase();
          const knownMenus = KNOWN_ORDER
            .map(key => menus.find(m => slugLower(m) === key))
            .filter((m): m is typeof menus[number] => !!m);
          const knownIds = new Set(knownMenus.map(m => m.id));
          const otherMenus = menus.filter(m => !knownIds.has(m.id));
          const pendingCount = Object.keys(menuSelections).length;

          function renderCheckbox(menu: typeof menus[number]) {
            const currentlyIn = menu.recipeIds.includes(recipe!.id);
            const pending = menuSelections[menu.id];
            const checked = pending !== undefined ? pending : currentlyIn;
            return (
              <label
                key={menu.id}
                className={`inline-flex items-center gap-2 text-sm cursor-pointer transition-colors px-2 py-1.5 ${checked ? 'text-accent' : ''}`}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    const val = e.target.checked;
                    setMenuSelections((prev) => {
                      const next = { ...prev };
                      if (val === currentlyIn) delete next[menu.id];
                      else next[menu.id] = val;
                      return next;
                    });
                  }}
                  className="w-4 h-4 accent-accent"
                />
                {menu.title}
              </label>
            );
          }

          return (
            <form onSubmit={handleSaveMenus} className="py-16">
              <div className="flex justify-center mb-3 opacity-60"><ForkKnife size={24} weight="light" aria-hidden /></div>
              <h2 className="text-xl font-bold mb-3 md:text-center">Add to a Menu</h2>
              <p className="text-sm text-[var(--color-text-secondary)] mb-6 md:text-center legible pretty md:mx-auto">
                Select which menus this recipe should appear on.
              </p>
              <div className="flex flex-wrap gap-3 md:justify-center">
                {knownMenus.map(renderCheckbox)}
              </div>
              {otherMenus.length > 0 && (
                <details className="mt-4 md:text-center">
                  <summary className="text-sm text-[var(--color-text-secondary)] cursor-pointer hover:underline">
                    Show all menus
                  </summary>
                  <div className="flex flex-wrap gap-3 md:justify-center mt-3">
                    {otherMenus.map(renderCheckbox)}
                  </div>
                </details>
              )}
              <div className="mt-6 md:text-center flex items-center justify-center gap-3">
                <button
                  type="reset"
                  disabled={pendingCount === 0}
                  onClick={() => setMenuSelections({})}
                  className="btn-secondary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Reset
                </button>
                <button
                  type="submit"
                  disabled={savingMenus || pendingCount === 0}
                  aria-busy={savingMenus}
                  className="btn-primary text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Save Menu Changes
                </button>
              </div>
              {menuStatus && (
                <p
                  role={menuStatus.type === 'error' ? 'alert' : 'status'}
                  aria-live="polite"
                  className={`mt-3 text-sm font-semibold md:text-center ${menuStatus.type === 'error' ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-secondary)]'}`}
                >
                  {menuStatus.message}
                </p>
              )}
            </form>
          );
        })()}

        </div>
      </aside>

      <Modal open={showPantryUpdate} onClose={() => setShowPantryUpdate(false)} title="Update pantry quantities">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-card)] shrink-0">
          <h2 className="font-bold text-lg">Update Pantry</h2>
          <button type="button" onClick={() => setShowPantryUpdate(false)} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1" aria-label="Close">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div className="overflow-y-auto flex-1 divide-y divide-[var(--color-border-card)]">
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
              <span className="text-xs text-[var(--color-text-secondary)] w-10">{item.unit ?? ''}</span>
            </div>
          ))}
          {pantryItems.length === 0 && (
            <p className="px-4 py-6 text-sm text-[var(--color-text-secondary)] text-center">No pantry items with tracked quantities.</p>
          )}
        </div>
        <div className="flex gap-3 p-4 border-t border-[var(--color-border-card)] shrink-0">
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
      </Modal>
    </>
  );
}

function CannabisIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M494.42 323.43c-1.2-.6-19.6-9.78-47.96-17.83 48.3-64.24 63.94-129.7 64.72-133.04a31.977 31.977 0 0 0-8.31-29.62 31.997 31.997 0 0 0-22.86-9.61c-2.19 0-4.4.23-6.59.69-3.34.7-66.31 14.35-130.68 55.97-8.59-97.8-57.86-172.39-60.14-175.8C276.64 5.32 266.67 0 256 0s-20.64 5.32-26.58 14.19c-2.29 3.41-51.56 78.01-60.14 175.8-64.37-41.62-127.34-55.27-130.68-55.97-2.19-.46-4.4-.69-6.59-.69-8.51 0-16.78 3.4-22.86 9.61a31.991 31.991 0 0 0-8.31 29.62c.77 3.34 16.42 68.79 64.72 133.04-28.37 8.05-46.77 17.23-47.96 17.83A32 32 0 0 0 0 351.98a32.005 32.005 0 0 0 17.54 28.57c2.3 1.17 54.42 27.19 120.97 29.89-2.84 6.84-4.26 11.06-4.41 11.51A31.999 31.999 0 0 0 164.48 464c3.04 0 6.11-.43 9.12-1.33 1.66-.49 31.46-9.55 66.39-30.71V504c0 4.42 3.58 8 8 8h16c4.42 0 8-3.58 8-8v-72.03c34.94 21.16 64.74 30.21 66.39 30.71 3.01.89 6.08 1.33 9.12 1.33 8.53 0 16.86-3.41 22.97-9.72a31.982 31.982 0 0 0 7.41-32.33c-.15-.45-1.56-4.67-4.41-11.51 66.55-2.71 118.66-28.73 120.97-29.89 10.77-5.45 17.55-16.5 17.54-28.57s-6.79-23.12-17.56-28.56zM362.4 378.66c-17.33 0-31.19-.9-42.49-2.42-.22.12-.4.16-.62.28 19.8 30.01 28.23 55.48 28.23 55.48s-48.08-14.3-91.52-50.5c-43.44 36.2-91.52 50.5-91.52 50.5s8.43-25.47 28.23-55.48c-.22-.12-.4-.16-.62-.28-11.3 1.53-25.16 2.42-42.49 2.42C84.65 378.66 32 352 32 352s40.95-20.67 95.13-25.58c-.85-.8-1.57-1.36-2.43-2.18C53.02 255.98 32 165.33 32 165.33s95.18 20.02 166.85 88.28c.93.89 1.57 1.63 2.48 2.51-.85-11.28-1.33-23.67-1.33-37.46C200 115.57 256 32 256 32s56 83.57 56 186.67c0 13.79-.48 26.18-1.33 37.46.91-.88 1.55-1.62 2.48-2.51C384.82 185.35 480 165.33 480 165.33s-21.02 90.64-92.7 158.9c-.86.82-1.58 1.38-2.43 2.18C439.05 331.33 480 352 480 352s-52.65 26.66-117.6 26.66z" />
    </svg>
  );
}

function WheatIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M454.06 171.37c-4.44-4.43-9.24-8.25-14.25-11.64 14.69-5.26 28.28-12.24 39.23-22.42 26.58-28.86 34.78-75.04 32.64-120.09-.44-9.23-8.03-16.47-17.26-16.91-4.28-.19-8.76-.31-13.4-.31-34.31 0-76.99 6.42-105.77 33.15-10.84 10.88-18.32 24.1-23.46 37.97-3.19-4.56-6.61-9.01-10.68-13.07l-34.45-34.43c-6.24-6.24-16.37-6.25-22.62 0L250.33 57.3c-17.5 17.49-26.49 40.07-27.66 62.97l-6.34-6.33c-6.24-6.24-16.37-6.25-22.62 0L160 147.63c-17.58 17.57-26.59 40.28-27.69 63.3l-6.48-6.48c-6.24-6.24-16.37-6.25-22.62 0L69.5 238.14c-37.51 37.49-37.51 98.3 0 135.8l22.96 22.95-87.76 87.8c-6.25 6.25-6.25 16.38 0 22.62C7.81 510.44 11.91 512 16 512s8.19-1.56 11.31-4.69l87.55-87.59 22.84 22.83c18.74 18.73 43.3 28.1 67.87 28.1s49.12-9.37 67.87-28.1l33.77-33.75c6.25-6.25 6.25-16.38 0-22.63l-6.47-6.47c22.98-1.11 45.66-10.11 63.21-27.66l33.77-33.75c6.25-6.25 6.25-16.38 0-22.63l-6.33-6.32c22.87-1.19 45.42-10.16 62.89-27.62l33.77-33.75c6.25-6.25 6.25-16.38 0-22.63l-33.99-33.97zM397.03 56.59c21.59-20.06 56.82-24.48 82.96-24.59-.21 36.03-8.62 65.65-23.67 82.71-21.99 19.63-56.99 23.78-82.66 23.78h-.38c-.34-25.94 3.95-61.99 23.75-81.9zM272.95 79.94l22.4-22.39 23.14 23.12c24.38 24.37 25.42 64.13.69 89.69-.29.25-.66.34-.93.62l-22.38 22.39-22.92-22.91c-25.01-24.99-25.04-65.49 0-90.52zm-90.33 90.33l22.4-22.39 23.14 23.13c13.62 13.62 33.75 53.21 1.95 88.16l-24.55 24.56-22.94-22.93c-25.02-25-25.04-65.5 0-90.53zM92.11 351.31c-25.02-25-25.04-65.5 0-90.53l22.4-22.39 23.14 23.13c23.78 23.76 25.63 62.42 1.75 88.4l-24.33 24.34-22.96-22.95zm158.7 68.61c-25 24.98-65.46 25.01-90.49 0l-22.66-22.65 22.45-22.43c24.99-24.98 65.46-25.02 90.49 0l22.66 22.65-22.45 22.43zm90.51-90.51c-25 24.98-65.46 25.01-90.49 0l-22.66-22.65 22.45-22.43c24.99-24.98 65.46-25.02 90.49 0l22.66 22.65-22.45 22.43zm90.33-90.33c-25 24.98-65.46 25.01-90.49 0l-22.66-22.65L340.95 194c24.99-24.98 65.46-25.02 90.49 0l22.66 22.65-22.45 22.43z" />
    </svg>
  );
}

function ShieldCheckIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M466.5 83.7l-192-80a48.15 48.15 0 0 0-36.9 0l-192 80C27.7 91.1 16 108.6 16 128c0 198.5 114.5 335.7 221.5 380.3 11.8 4.9 25.1 4.9 36.9 0C360.1 472.6 496 349.3 496 128c0-19.4-11.7-36.9-29.5-44.3zM262.2 478.8c-4 1.6-8.4 1.6-12.3 0C152 440 48 304 48 128c0-6.5 3.9-12.3 9.8-14.8l192-80c3.9-1.6 8.4-1.6 12.3 0l192 80c6 2.5 9.9 8.3 9.8 14.8.1 176-103.9 312-201.7 350.8zm136.2-325c-4.7-4.7-12.3-4.7-17-.1L218 315.8l-69-69.5c-4.7-4.7-12.3-4.7-17-.1l-8.5 8.5c-4.7 4.7-4.7 12.3-.1 17l85.9 86.6c4.7 4.7 12.3 4.7 17 .1l180.5-179c4.7-4.7 4.7-12.3.1-17z" />
    </svg>
  );
}

function TintIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 352 512" fill="currentColor" aria-hidden="true">
      <path d="M205.22 22.09C201.21 7.53 188.61 0 175.97 0c-12.35 0-24.74 7.2-29.19 22.09C100.01 179.85 0 222.72 0 333.91 0 432.35 78.72 512 176 512s176-79.65 176-178.09c0-111.75-99.79-153.34-146.78-311.82zM176 480c-79.4 0-144-65.54-144-146.09 0-48.36 23-81.32 54.84-126.94 29.18-41.81 65.34-93.63 89.18-170.91 23.83 77.52 60.06 129.31 89.3 171.08C297.06 252.52 320 285.3 320 333.91 320 414.46 255.4 480 176 480zm0-64c-44.12 0-80-35.89-80-80 0-8.84-7.16-16-16-16s-16 7.16-16 16c0 61.75 50.25 112 112 112 8.84 0 16-7.16 16-16s-7.16-16-16-16z" />
    </svg>
  );
}

function ExclamationTriangleIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true">
      <path d="M270.2 160h35.5c3.4 0 6.1 2.8 6 6.2l-7.5 196c-.1 3.2-2.8 5.8-6 5.8h-20.5c-3.2 0-5.9-2.5-6-5.8l-7.5-196c-.1-3.4 2.6-6.2 6-6.2zM288 388c-15.5 0-28 12.5-28 28s12.5 28 28 28 28-12.5 28-28-12.5-28-28-28zm281.5 52L329.6 24c-18.4-32-64.7-32-83.2 0L6.5 440c-18.4 31.9 4.6 72 41.6 72H528c36.8 0 60-40 41.5-72zM528 480H48c-12.3 0-20-13.3-13.9-24l240-416c6.1-10.6 21.6-10.7 27.7 0l240 416c6.2 10.6-1.5 24-13.8 24z" />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M462.3 62.7c-54.5-46.4-136-38.7-186.6 13.5L256 96.6l-19.7-20.3C195.5 34.1 113.2 8.7 49.7 62.7c-62.8 53.6-66.1 149.8-9.9 207.8l193.5 199.8c6.2 6.4 14.4 9.7 22.6 9.7 8.2 0 16.4-3.2 22.6-9.7L472 270.5c56.4-58 53.1-154.2-9.7-207.8zm-13.1 185.6L256.4 448.1 62.8 248.3c-38.4-39.6-46.4-115.1 7.7-161.2 54.8-46.8 119.2-12.9 142.8 11.5l42.7 44.1 42.7-44.1c23.2-24 88.2-58 142.8-11.5 54 46 46.1 121.5 7.7 161.2z" />
    </svg>
  );
}

function FishIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 640 512" fill="currentColor" aria-hidden="true">
      <path d="M363.44 80c-99.96 0-187.27 60.25-235.86 111.79l-97.04-72.66c-3.65-2.73-7.78-3.94-11.8-3.94-10.85 0-20.87 8.78-18.36 20.06L27.27 256 .39 376.74c-2.51 11.28 7.52 20.06 18.36 20.06 4.02 0 8.15-1.21 11.8-3.94l97.04-72.66C176.17 371.75 263.48 432 363.44 432 516.18 432 640 291.2 640 256c0-35.2-123.82-176-276.56-176zm0 320c-86.02 0-166.21-52.56-212.57-101.74l-19.6-20.79-22.87 17.12-68.33 51.17 18.43-82.8 1.55-6.95-1.55-6.95-18.43-82.8 68.33 51.17 22.87 17.12 19.6-20.79C197.23 164.56 277.42 112 363.44 112 489 112 595.86 223.33 607.5 256 595.86 288.67 489 400 363.44 400zM448 232c-13.25 0-24 10.74-24 24 0 13.25 10.75 24 24 24s24-10.75 24-24c0-13.26-10.75-24-24-24z" />
    </svg>
  );
}

function CarrotIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      <path d="M504.6 138.5c-22.9-27.6-53.4-43.4-86.4-44.8-1.6-32.1-17.1-63.4-44.7-86.3-5.9-4.9-13.1-7.4-20.4-7.4-7.2 0-14.5 2.5-20.4 7.4-27.2 22.6-43.1 53-44.6 85.8-.7 14.5 1.8 28.7 6.6 42.2-13.3-4.4-26.8-7.3-40.3-7.3-48 0-94.1 26.8-116.6 72.8L2.4 478.3c-3 6.2-3.3 13.8 0 20.5 4.1 8.3 12.4 13.1 21 13.1 3.4 0 6.9-.8 10.2-2.4L311.2 374c25-12.2 46.4-32.6 59.6-59.6 15.4-31.5 16.7-66.2 6.5-97.1 11.8 4.1 23.9 6.6 36.4 6.6 34.7 0 67-15.9 90.9-44.7 9.9-11.7 9.9-28.9 0-40.7zm-162.5 162c-9.6 19.7-25.2 35.3-44.9 44.9l-124.8 60.9c-.4-.5-.6-1.1-1.1-1.6l-32-32c-6.2-6.2-16.4-6.2-22.6 0-6.2 6.2-6.2 16.4 0 22.6l25.6 25.6-100.2 49L154 240.6l26.7 26.7c3.1 3.1 7.2 4.7 11.3 4.7s8.2-1.6 11.3-4.7c6.2-6.2 6.2-16.4 0-22.6l-32-32c-.7-.7-1.7-1.1-2.5-1.7 17.1-31.5 49.4-51 85.6-51 14.9 0 29.2 3.3 42.7 9.9 23.4 11.4 41 31.3 49.5 56s6.9 51.1-4.5 74.6zM413.8 192c-21.5 0-43.1-8.9-60.6-26.5l-6.7-6.7c-37.2-37.1-35.4-92 6.6-126.8 33.2 27.5 41.5 67.6 25.3 101.6 11.2-5.3 23-8 34.9-8 24.1 0 48.3 11.1 66.7 33.3-18.3 22.1-42.3 33.1-66.2 33.1z" />
    </svg>
  );
}

function LeafIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-leaf (light) */}
      <path d="M546.2 9.7c-2.9-6.5-8.6-9.7-14.3-9.7-5.3 0-10.7 2.8-14 8.5C486.9 62.4 431.4 96 368 96h-80C182 96 96 182 96 288c0 20.9 3.4 40.9 9.6 59.7C29.3 413 1.4 489.4.9 490.7c-2.9 8.3 1.5 17.5 9.8 20.4 7.9 2.8 17.4-1.1 20.4-9.8.4-1.2 23.9-65.1 87.6-122.7C151.1 438.9 214.7 480 288 480c6.9 0 13.7-.4 20.4-1.1C465.5 467.5 576 326.8 576 154.3c0-50.2-10.8-102.2-29.8-144.6zM305 447.1c-5.9.6-11.6.9-17 .9-63.3 0-117.6-37.2-143.5-90.6C196.3 319 268.6 288 368 288c8.8 0 16-7.2 16-16s-7.2-16-16-16c-102.8 0-179 31-234.8 70.4-3.1-12.4-5.2-25.1-5.2-38.4 0-88.2 71.8-160 160-160h80c63.3 0 121-28.4 159.7-77.2 10.5 32.3 16.3 68.7 16.3 103.5 0 159.6-100.1 282.7-239 292.8z" />
    </svg>
  );
}

function SeedlingIcon({ size = 12 }: { size?: number; weight?: string; 'aria-hidden'?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-seedling (light) */}
      <path d="M442.7 32c-95.9 0-176.4 79.4-197.2 185.7C210.5 145.1 144.8 96 69.3 96H0v16c0 132.3 90.9 240 202.7 240H240v120c0 4.4 3.6 8 8 8h16c4.4 0 8-3.6 8-8V288h37.3C421.1 288 512 180.3 512 48V32h-69.3zm-240 288C113 320 39.2 235.2 32.5 128h36.8c89.7 0 163.4 84.8 170.2 192h-36.8zm106.6-64h-36.8C279.2 148.8 353 64 442.7 64h36.8c-6.7 107.2-80.5 192-170.2 192z" />
    </svg>
  );
}

function MapleLeafIcon({ size = 12 }: { size?: number; weight?: string; 'aria-hidden'?: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-leaf-maple (light). Picked over
          Phosphor Tree because Phosphor has no autumn-leaf glyph and
          maple is the universally-recognized "fall" symbol across
          cultures. */}
      <path d="M496.06 163.47l-27.34-16.41 8.44-75.97c2.14-19.5-13.61-38.41-36.25-36.27l-75.97 8.45-16.41-27.34C342.62 6.11 332.28.16 320.81 0c-10.59-.02-21.97 5.53-28.12 15.2l-42.91 67.45c-8.33-22.52-32.9-24.41-42.53-19.2l-13.81 7.41-35.09-39.72c-6.17-7.71-15.42-12.31-25.62-12.31-10.03 0-19.37 4.47-25.16 11.7L72 70.86l-13.81-7.41c-18.48-9.99-50.1 8.62-43.72 37.31l29.41 142.69-24 10.3c-26.45 11.34-26.45 49 0 60.34l108.79 46.62L4.69 484.69c-6.25 6.25-6.25 16.38 0 22.62C7.81 510.44 11.91 512 16 512s8.19-1.56 11.31-4.69l123.98-123.98 46.62 108.74c5.19 12.18 17.11 19.92 30.19 19.92 13.12 0 24.97-7.8 30.19-19.91l10.25-23.98L411 497.5c23.83 5.29 47.82-17.22 38.97-40l-8.84-17.5 39.75-35.09c16.65-13.35 16.07-38.02.34-50.97l-40.09-35.38 7.41-13.8c6.34-11.73 1.1-35.19-19.22-42.52l67.5-42.94c20.67-13.17 20.05-43.34-.76-55.83zM342.94 279.28c-15.25 9.71-5.02 33.47 12.56 29l62.78-14.8-17.34 32.3 60.43 53.51-60.43 53.49 17.78 33.12-169.32-34.42-22.06 48.02-51.68-120.54L331.3 203.32c6.25-6.25 6.25-16.38 0-22.62-6.25-6.25-16.37-6.25-22.62 0L153.16 336.21 32.5 283.16l48-20.58L46.87 93.69l32.31 17.36 54.66-59.33 52.41 59.33 33.41-17.95.16.47-16.09 62.94c-4.45 17.53 19.18 27.83 29 12.56L321.1 32.41l26.97 44.94 97.28-9.78-10.69 96.37 44.97 28.38-136.69 86.96z" />
    </svg>
  );
}

