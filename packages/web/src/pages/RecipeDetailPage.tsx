import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { recipeToDataURI, downloadRecipeICS, imageToDataURI } from '@pantry-host/shared/export-recipe';
import { downloadCooklang, stepPhotoBaseUrl } from '@pantry-host/shared/cooklang';
import { hasCooklangSyntax, extractCooklang } from '@pantry-host/shared/cooklang-parser';
import PixabayImage from '@pantry-host/shared/components/PixabayImage';
import { NutritionSource } from '@pantry-host/shared/components/NutritionSource';
import { readFavorites, toggleFavorite } from '@pantry-host/shared/favorites';
import PublishToBlueskyButton from '@pantry-host/shared/components/PublishToBlueskyButton';
import { AllergensLine } from '@pantry-host/shared/components/AllergensLine';
import { getAllergenIcon } from '@pantry-host/shared/components/allergen-icons';
import { groupIngredients } from '@pantry-host/shared/ingredient-groups';
import { resolveGroceryStatus, pantryIndex, findPantryItem } from '@pantry-host/shared/grocery-status';
import { getFileURL } from '@/lib/storage-opfs';
import { PencilSimple, Trash, Printer, CalendarPlus, Export, Code, ShareNetwork, Rows, Columns, GridNine, ArrowsOut, ArrowsIn, Heart, CheckCircle, Circle } from '@phosphor-icons/react';

/** Resolves opfs:// URLs to blob URLs for display */
function OpfsImage({ src, alt, className }: { src: string; alt: string; className?: string }) {
  const [resolved, setResolved] = useState<string | null>(null);
  useEffect(() => {
    if (src.startsWith('opfs://')) {
      getFileURL(src.replace('opfs://', '')).then(setResolved).catch(() => setResolved(null));
    } else {
      setResolved(src);
    }
  }, [src]);
  if (!resolved) return null;
  return <img src={resolved} alt={alt} className={className} loading="lazy" />;
}

interface RecipeIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  itemSize: number | null;
  itemSizeUnit: string | null;
  sourceRecipeId: string | null;
}

interface Recipe {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  instructions: string;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  tags: string[];
  requiredCookware: { id: string; name: string; brand: string | null }[];
  photoUrl: string | null;
  stepPhotos: string[];
  sourceUrl: string | null;
  queued: boolean;
  lastMadeAt: string | null;
  ingredients: RecipeIngredient[];
  /** Recursively-unfurled ingredient list — feeds AllergensLine so
   *  warnings bubble up through sub-recipes. */
  groceryIngredients: Pick<RecipeIngredient, 'ingredientName' | 'quantity' | 'unit' | 'itemSize' | 'itemSizeUnit'>[];
  usedIn: SubRecipe[];
  createdAt: string;
}

interface SubRecipe {
  id: string;
  slug: string | null;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  tags: string[];
  photoUrl: string | null;
}

const RECIPE_QUERY = `query($id: String!) {
  recipe(id: $id) {
    id slug title description instructions servings prepTime cookTime
    tags requiredCookware { id name brand } photoUrl stepPhotos sourceUrl queued lastMadeAt createdAt
    ingredients { ingredientName quantity unit itemSize itemSizeUnit sourceRecipeId }
    groceryIngredients { ingredientName quantity unit itemSize itemSizeUnit }
    usedIn { id slug title cookTime prepTime servings tags photoUrl }
  }
}`;

const GRID_OPTIONS = [
  { cols: 3, Icon: GridNine, label: '3 columns' },
  { cols: 2, Icon: Columns, label: '2 columns' },
  { cols: 1, Icon: Rows, label: '1 column' },
] as const;

function StepPhotos({ instructions, sourceUrl, dbStepPhotos }: { instructions: string; sourceUrl: string | null; dbStepPhotos?: string[] }) {
  const [gridCols, setGridCols] = useState(3);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const errorCount = useRef(0);
  const hasDbPhotos = dbStepPhotos?.some((url) => url && url.length > 0);
  const base = !hasDbPhotos && sourceUrl ? stepPhotoBaseUrl(sourceUrl) : null;
  if (!hasDbPhotos && !base) return null;

  const steps = instructions.split(/\n+/).filter((l) => /^\d+\./.test(l.trim()));
  if (steps.length === 0) return null;

  return (
    <div className="mt-10" ref={wrapperRef}>
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
          const stepText = step.replace(/^\d+\.\s*/, '');
          const imgEl = photoUrl.startsWith('opfs://') ? (
            <OpfsImage src={photoUrl} alt={`Step ${stepNum}`} className="w-full aspect-[4/3] object-cover" />
          ) : (
            <img
              src={photoUrl}
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
          );
          return (
            <div key={stepNum} className="card rounded-xl overflow-hidden">
              {imgEl}
              <div className="p-3">
                <span className="text-xs font-bold text-[var(--color-text-secondary)]">Step {stepNum}</span>
                <p className="text-sm mt-1 line-clamp-3">{stepText}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

interface PantryItemForCheck {
  name: string;
  aliases: string[] | null;
  quantity: number | null;
  unit: string | null;
  itemSize: number | null;
  itemSizeUnit: string | null;
  alwaysOnHand: boolean;
  barcode: string | null;
  productMeta: string | null;
}

export default function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportPhotoUrl, setExportPhotoUrl] = useState<string | null>(null);
  const [displayPhotoUrl, setDisplayPhotoUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  // Pantry snapshot for ingredient auto-check. Fetched once on mount; the
  // merge effect below ticks checkboxes for ingredients whose grocery
  // status would be 'have' (see packages/shared/src/grocery-status.ts).
  const [pantry, setPantry] = useState<PantryItemForCheck[] | null>(null);
  const pantryAutoCheckedRef = useRef(false);
  const [subRecipes, setSubRecipes] = useState<SubRecipe[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState(false);
  const [servings, setServings] = useState(2);
  const articleRef = useRef<HTMLDivElement>(null);
  const [copiedUri, setCopiedUri] = useState(false);
  // "I Made This" / "Add to Favorites" state — mirrors the app detail page.
  const [completing, setCompleting] = useState(false);
  const [favorited, setFavorited] = useState(false);
  useEffect(() => {
    if (!recipe) return;
    setFavorited(readFavorites().includes(recipe.id));
  }, [recipe?.id]);

  async function handleComplete() {
    if (!recipe || completing) return;
    setCompleting(true);
    try {
      const data = await gql<{ completeRecipe: { lastMadeAt: string } }>(
        `mutation($id: String!, $servings: Int) { completeRecipe(id: $id, servings: $servings) { id lastMadeAt } }`,
        { id: recipe.id, servings },
      );
      setRecipe({ ...recipe, lastMadeAt: data.completeRecipe.lastMadeAt });
    } catch (err) {
      console.error(err);
    }
    setCompleting(false);
  }

  function handleToggleFavorite() {
    if (!recipe) return;
    const next = toggleFavorite(recipe.id);
    setFavorited(next.includes(recipe.id));
  }

  useEffect(() => {
    setSupportsFullscreen(Boolean(document.documentElement.requestFullscreen || (document.documentElement as any).webkitRequestFullscreen));
    function onFSChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  // Pantry fetch for ingredient auto-check. Runs independently of the
  // recipe load so both can resolve in parallel.
  useEffect(() => {
    gql<{ ingredients: PantryItemForCheck[] }>(
      `{ ingredients { name aliases quantity unit itemSize itemSizeUnit alwaysOnHand barcode productMeta } }`,
    )
      .then((d) => setPantry(d.ingredients ?? []))
      .catch((err) => { console.warn('[pantry fetch]', err); setPantry([]); });
  }, []);

  // One-shot merge: when both recipe + pantry are loaded, auto-check
  // ingredients whose grocery status resolves to 'have'. Guarded by a
  // ref so user unchecks aren't overwritten by subsequent refetches.
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

  // Fetch sub-recipes (recipes used as ingredients)
  useEffect(() => {
    if (!recipe) return;
    const sourceIds = recipe.ingredients
      .map((i) => i.sourceRecipeId)
      .filter((id): id is string => id != null);
    if (sourceIds.length === 0) { setSubRecipes([]); return; }
    Promise.all(
      sourceIds.map((id) =>
        gql<{ recipe: SubRecipe | null }>(
          `query($id: String!) { recipe(id: $id) { id slug title cookTime prepTime servings tags photoUrl } }`,
          { id },
        ).then((d) => d.recipe),
      ),
    ).then((results) => setSubRecipes(results.filter((r): r is SubRecipe => r != null)));
  }, [recipe]);

  // Resolve photo URLs for display and export
  useEffect(() => {
    const photoUrl = recipe?.photoUrl;
    if (!photoUrl) { setExportPhotoUrl(null); setDisplayPhotoUrl(null); return; }
    if (photoUrl.startsWith('opfs://')) {
      const filename = photoUrl.replace('opfs://', '');
      getFileURL(filename)
        .then((blobUrl) => { setDisplayPhotoUrl(blobUrl); setExportPhotoUrl(blobUrl); })
        .catch(() => { setDisplayPhotoUrl(null); setExportPhotoUrl(null); });
      return;
    }
    if (photoUrl.startsWith('/uploads/')) {
      setDisplayPhotoUrl(photoUrl);
      const uuid = photoUrl.replace(/^\/uploads\//, '').replace(/\.\w+$/, '');
      imageToDataURI(`/uploads/${uuid}-400.jpg`)
        .then(setExportPhotoUrl)
        .catch(() => setExportPhotoUrl(photoUrl));
      return;
    }
    setDisplayPhotoUrl(photoUrl);
    setExportPhotoUrl(photoUrl);
  }, [recipe?.photoUrl]);

  useEffect(() => {
    if (!slug) return;
    gql<{ recipe: Recipe | null }>(RECIPE_QUERY, { id: slug })
      .then((d) => setRecipe(d.recipe))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleDelete() {
    if (!recipe) return;
    await gql(`mutation($id: String!) { deleteRecipe(id: $id) }`, { id: recipe.id });
    navigate('/recipes#stage');
  }

  async function handleToggleQueue() {
    if (!recipe) return;
    const { toggleRecipeQueued: updated } = await gql<{ toggleRecipeQueued: Recipe }>(
      `mutation($id: String!) { toggleRecipeQueued(id: $id) { id queued } }`,
      { id: recipe.id },
    );
    setRecipe({ ...recipe, queued: updated.queued });
  }

  // Reset servings when recipe loads
  useEffect(() => { if (recipe?.servings) setServings(recipe.servings); }, [recipe?.servings]);

  if (loading) return <div className="h-40 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />;
  if (!recipe) return <p className="text-[var(--color-text-secondary)]">Recipe not found.</p>;

  const baseServings = recipe.servings ?? 2;
  const scaleFactor = servings / baseServings;
  function scaleQty(qty: number | null) {
    if (qty == null) return null;
    return Math.round(qty * scaleFactor * 100) / 100;
  }

  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);

  // Runtime Cooklang: if instructions contain .cook syntax, parse it
  // live for display. The raw syntax stays in the DB for round-trip
  // editing; we just strip it here for readability.
  const rawInstructions = recipe.instructions ?? '';
  const isCooklang = hasCooklangSyntax(rawInstructions);
  const cooklangData = isCooklang ? extractCooklang(rawInstructions) : null;
  const displayInstructions = cooklangData?.cleanedText ?? rawInstructions;
  const steps = displayInstructions.split('\n').map((s) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);

  return (
    <div>
      {/* Action bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-6 border-b" style={{ borderColor: 'var(--color-border-card)' }}>
        <Link to="/recipes#stage" className="text-sm text-[var(--color-text-secondary)] hover:underline">
          &larr; Recipes
        </Link>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={handleToggleQueue}
            className={`btn-secondary text-sm${recipe.queued ? ' border-[var(--color-accent)] text-[var(--color-accent)]' : ''}`}
          >
            {recipe.queued ? '- Grocery List' : '+ Grocery List'}
          </button>
          <Link to={`/recipes/${slug}/edit#stage`} className="btn-secondary text-sm">Edit</Link>
          {deleteConfirm ? (
            <div className="flex gap-2 items-center">
              <span className="text-sm text-[var(--color-text-secondary)]">Delete?</span>
              <button type="button" autoFocus onClick={handleDelete} className="btn-danger text-sm">Yes</button>
              <button type="button" onClick={() => setDeleteConfirm(false)} className="btn-secondary text-sm">No</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="btn-secondary btn-delete p-2"
              aria-label="Delete recipe"
            >
              <Trash size={16} aria-hidden />
            </button>
          )}
          {supportsFullscreen && (
            <button
              type="button"
              onClick={() => {
                if (isFullscreen) {
                  document.exitFullscreen().catch(() => {});
                } else {
                  articleRef.current?.requestFullscreen().catch(() => {});
                }
              }}
              aria-label={isFullscreen ? 'Exit full screen' : 'Enter full screen'}
              aria-pressed={isFullscreen}
              className="btn-secondary p-2"
            >
              {isFullscreen ? <ArrowsIn size={18} aria-hidden /> : <ArrowsOut size={18} aria-hidden />}
            </button>
          )}
        </div>
      </div>

      <article ref={articleRef} aria-label={recipe.title}>
      {/* Zen exit button (visible only in fullscreen) */}
      <button
        type="button"
        onClick={() => document.exitFullscreen().catch(() => {})}
        aria-label="Exit full screen"
        className="zen-exit-btn fixed top-4 right-4 z-50 bg-[rgba(0,0,0,0.7)] hover:bg-[rgba(0,0,0,0.9)] text-white p-2 rounded-full backdrop-blur transition-colors hidden outline outline-1 outline-current"
      >
        <ArrowsIn size={18} aria-hidden />
      </button>

      {/* Photo */}
      {displayPhotoUrl ? (
        <div className="mb-8 aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
          <img
            src={displayPhotoUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        </div>
      ) : (() => {
        const pixabayKey = typeof window !== 'undefined' ? window.localStorage.getItem('pixabay-api-key') : null;
        const pixabayEnabled = typeof window !== 'undefined' && window.localStorage.getItem('pixabay-fallback-enabled') === 'true';
        return pixabayEnabled && pixabayKey ? (
          <div className="mb-8">
            <PixabayImage recipe={{ id: recipe.id, title: recipe.title }} apiKey={pixabayKey} alt={recipe.title} hidePlaceholder />
          </div>
        ) : null;
      })()}

      {/* Tags above title. Vegetarian is the only featured tag with a
          visual treatment on the web package today — other featured tags
          (gluten-free, pescatarian, breastfeeding-*, etc.) render plain
          here until the full app decoration pattern is ported. */}
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {recipe.tags.some((t) => t.toLowerCase() === 'vegetarian') && (
            <span className="tag inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400" title="Vegetarian">
              <CarrotIcon />
              vegetarian
            </span>
          )}
          {/* Allergen warning chips — `contains-*` tags get the amber
              warning treatment via the shared --color-warning token. */}
          {recipe.tags.filter((t) => t.toLowerCase().startsWith('contains-')).map((t) => {
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
          {recipe.tags
            .filter((t) => t.toLowerCase() !== 'vegetarian' && !t.toLowerCase().startsWith('contains-'))
            .map((tag) => (
              <span key={tag} className="tag">{tag}</span>
            ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>

      {/* Description */}
      {recipe.description && (
        <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed max-w-prose mb-5 whitespace-pre-line">{recipe.description.split(/(https?:\/\/\S+)/g).map((part, i) => /^https?:\/\//.test(part) ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-accent)]">{part.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a> : part)}</p>
      )}

      {/* Metadata */}
      <dl className="mt-5 flex flex-wrap gap-6 text-sm">
        {totalTime > 0 && (
          <div>
            <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Total Time</dt>
            <dd>{totalTime} min</dd>
          </div>
        )}
        {recipe.prepTime != null && recipe.prepTime > 0 && (
          <div>
            <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Prep</dt>
            <dd>{recipe.prepTime} min</dd>
          </div>
        )}
        {recipe.cookTime != null && recipe.cookTime > 0 && (
          <div>
            <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Cook</dt>
            <dd>{recipe.cookTime} min</dd>
          </div>
        )}
        <div>
          <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Servings</dt>
          <dd>
            <div className="flex items-center gap-2" aria-label="Adjust servings">
              <button type="button" onClick={() => setServings((s) => Math.max(1, s - 1))} aria-label="Decrease servings" className="w-7 h-7 border border-[var(--color-border-card)] rounded-lg flex items-center justify-center hover:bg-[var(--color-accent-subtle)] text-lg leading-none">&minus;</button>
              <span className="tabular-nums font-bold w-5 text-center">{servings}</span>
              <button type="button" onClick={() => setServings((s) => s + 1)} aria-label="Increase servings" className="w-7 h-7 border border-[var(--color-border-card)] rounded-lg flex items-center justify-center hover:bg-[var(--color-accent-subtle)] text-lg leading-none">+</button>
            </div>
          </dd>
        </div>
      </dl>

      {/* Cookware */}
      {recipe.requiredCookware.length > 0 && (
        <div className="mt-5">
          <span className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">Cookware</span>
          <div className="flex flex-wrap gap-2 mt-1">
            {recipe.requiredCookware.map((c) => (
              <Link key={c.id} to={`/cookware/${c.id}#stage`} className="tag hover:underline">
                {c.name}{c.brand && c.brand !== c.name && <em className="font-normal"> by {c.brand}</em>}
              </Link>
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
            <>Source: <a href={recipe.sourceUrl} className="underline" rel="noopener noreferrer" target="_blank">{recipe.sourceUrl.includes('github.com') ? recipe.sourceUrl.replace('https://github.com/', '').split('/').slice(0, 2).join('/') : (() => { try { return new URL(recipe.sourceUrl).hostname; } catch { return recipe.sourceUrl; } })()}</a></>
          )}
        </p>
      )}

      {/* Allergens — uses `groceryIngredients` so warnings bubble up
          through sub-recipes (almonds in an Almond Milk sub-recipe
          surface "Nuts" on the parent). Silent when no matches. */}
      <AllergensLine
        ingredients={recipe.groceryIngredients}
        pantry={pantry ?? []}
        recipeTags={recipe.tags}
      />

      {/* Two-column: Ingredients | Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 mt-10">
        <section>
          <h2 className="text-xl font-bold mb-4">Ingredients</h2>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No ingredients listed.</p>
          ) : (
            <div className="space-y-4 legible">
              {groupIngredients(recipe.ingredients).map((g, gi) => {
                const items = (
                  <ul role="list" className="space-y-2">
                    {g.items.map((ing) => {
                      const checked = checkedIngredients.has(ing.index);
                      return (
                        <li key={ing.index}>
                          <label className="flex items-start gap-3 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => setCheckedIngredients((prev) => { const next = new Set(prev); next.has(ing.index) ? next.delete(ing.index) : next.add(ing.index); return next; })}
                              aria-label={ing.ingredientName}
                              className="mt-1 w-5 h-5 border-2 border-[var(--color-border-card)] accent-[var(--color-accent)] shrink-0"
                            />
                            {/* No line-through when checked — keep ingredient text legible
                                regardless of on-hand status. */}
                            <span className={checked ? 'text-[var(--color-text-secondary)]' : ''}>
                              {scaleQty(ing.quantity) != null && <span className="font-semibold tabular-nums">{scaleQty(ing.quantity)}{' '}</span>}
                              {ing.itemSize != null ? (
                                <span className="tabular-nums">{ing.itemSize}{ing.itemSizeUnit ?? ''} </span>
                              ) : (
                                ing.unit && <span>{ing.unit} </span>
                              )}
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
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Instructions</h2>
          <ol className="space-y-3 legible">
            {steps.map((step, idx) => (
              <li key={idx} className="flex items-baseline gap-4">
                <span className="shrink-0 w-8 text-right text-sm tabular-nums text-[var(--color-text-secondary)] select-none" aria-hidden="true">{idx + 1}.</span>
                <p className="leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <StepPhotos instructions={recipe.instructions} sourceUrl={recipe.sourceUrl} dbStepPhotos={recipe.stepPhotos} />

      {/* Nutrition panel — recipe-api.com when available, otherwise
          aggregated from pantry OFF metadata where possible. */}
      <NutritionSource
        sourceUrl={recipe.sourceUrl}
        recipeApiKey={typeof window !== 'undefined' ? localStorage.getItem('recipe-api-key') : null}
        ingredients={recipe.ingredients}
        pantry={pantry ?? []}
        servings={recipe.servings}
      />

      {/* Three-CTA action strip: I Made This · Add it to the List · Favorite.
          Mirrors the app detail page. Each action is independent; their
          state comes from different sources (lastMadeAt mutation, queued
          mutation, localStorage). */}
      <aside className="no-print pt-10 mt-10 border-t border-[var(--color-border-card)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:text-center">
          <section aria-labelledby="made-this-heading">
            <h2 id="made-this-heading" className="text-xl font-bold mb-3">I Made This</h2>
            <button
              type="button"
              onClick={handleComplete}
              disabled={completing}
              aria-busy={completing}
              aria-pressed={!!recipe.lastMadeAt}
              className="inline-flex items-center gap-2 btn-secondary text-sm transition-colors"
            >
              {recipe.lastMadeAt
                ? <CheckCircle size={18} weight="fill" aria-hidden />
                : <Circle size={18} aria-hidden />}
              {recipe.lastMadeAt ? 'I Made This Again' : 'I Made This'}
            </button>
            <p className="text-sm text-[var(--color-text-secondary)] mt-3">
              Mark this recipe as made to track when you last cooked it.
            </p>
            {recipe.lastMadeAt && (Date.now() - new Date(recipe.lastMadeAt).getTime()) > 7 * 24 * 60 * 60 * 1000 && (
              <p className="mt-2 text-xs italic text-[var(--color-text-secondary)]">
                Last made on {new Date(recipe.lastMadeAt).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}
              </p>
            )}
          </section>

          <section aria-labelledby="queue-heading">
            <h2 id="queue-heading" className="text-xl font-bold mb-3">Add it to the List</h2>
            <button
              type="button"
              onClick={handleToggleQueue}
              aria-pressed={recipe.queued}
              aria-label={recipe.queued ? 'Remove from grocery list' : 'Add to grocery list'}
              className={`btn-primary text-sm transition-colors ${recipe.queued ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : ''}`}
            >
              {recipe.queued ? '✓ On List' : '+ Grocery List'}
            </button>
            <p className="text-sm text-[var(--color-text-secondary)] mt-3">
              Add ingredients for this recipe to your grocery list.
            </p>
          </section>

          <section aria-labelledby="feedback-heading">
            <h2 id="feedback-heading" className="text-xl font-bold mb-3">What&rsquo;d you Think?</h2>
            <button
              type="button"
              onClick={handleToggleFavorite}
              aria-pressed={favorited}
              className={`inline-flex items-center gap-2 btn-secondary text-sm transition-colors ${favorited ? 'border-[var(--color-accent)] text-[var(--color-accent)]' : ''}`}
            >
              <Heart size={18} weight={favorited ? 'fill' : 'regular'} aria-hidden />
              {favorited ? 'Favorited' : 'Add to Favorites'}
            </button>
            <p className="text-sm text-[var(--color-text-secondary)] mt-3">
              Save this recipe to your favorites so you can find it again later.
            </p>
          </section>
        </div>
      </aside>

      {subRecipes.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-4">Made from Scratch</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {subRecipes.map((r) => (
              <Link key={r.id} to={`/recipes/${r.slug || r.id}#stage`} className="card rounded-xl overflow-hidden hover:underline">
                {r.photoUrl && (
                  <div className="aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
                    <OpfsImage src={r.photoUrl} alt={r.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-bold text-base">{r.title}</h3>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {[(r.prepTime ?? 0) + (r.cookTime ?? 0) > 0 && `${(r.prepTime ?? 0) + (r.cookTime ?? 0)} min`, r.servings && `${r.servings} servings`].filter(Boolean).join(' \u00b7 ')}
                  </span>
                  {r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.tags.slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {(recipe.usedIn ?? []).length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-4">Made With This</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {recipe.usedIn.map((r) => (
              <Link key={r.id} to={`/recipes/${r.slug || r.id}#stage`} className="card rounded-xl overflow-hidden hover:underline">
                {r.photoUrl && (
                  <div className="aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
                    <OpfsImage src={r.photoUrl} alt={r.title} className="w-full h-full object-cover" />
                  </div>
                )}
                <div className="p-4">
                  <h3 className="font-bold text-base">{r.title}</h3>
                  <span className="text-sm text-[var(--color-text-secondary)]">
                    {[(r.prepTime ?? 0) + (r.cookTime ?? 0) > 0 && `${(r.prepTime ?? 0) + (r.cookTime ?? 0)} min`, r.servings && `${r.servings} servings`].filter(Boolean).join(' \u00b7 ')}
                  </span>
                  {r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {r.tags.slice(0, 4).map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="py-16 no-print">
        <div className="flex justify-center mb-3 opacity-60"><ShareNetwork size={24} weight="light" aria-hidden /></div>
        <h2 className="text-xl font-bold mb-3 md:text-center">Share {recipe.title}</h2>
        <p className="text-sm text-[var(--color-text-secondary)] mb-10 md:text-center very legible pretty md:mx-auto">Print this recipe, export it as HTML to share with a friend, add it to your calendar for meal planning, or export as a Cooklang .cook file.</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex flex-col md:flex-row items-center gap-1 md:gap-2 btn-secondary text-sm justify-self-center border-0 bg-transparent md:border md:border-[var(--color-border-card)] md:bg-transparent"
          >
            <Printer size={18} aria-hidden />
            Print Recipe
          </button>
          <a
            href={recipeToDataURI({ ...recipe, requiredCookware: recipe.requiredCookware.map(c => c.name).filter(Boolean), source: '', sourceUrl: null, photoUrl: exportPhotoUrl })}
            download={`${recipe.slug || 'recipe'}.html`}
            className="flex flex-col md:flex-row items-center gap-1 md:gap-2 btn-secondary text-sm justify-self-center border-0 bg-transparent md:border md:border-[var(--color-border-card)] md:bg-transparent"
          >
            <Export size={18} aria-hidden />
            Export HTML
          </a>
          <button
            type="button"
            onClick={() => downloadRecipeICS({ ...recipe, requiredCookware: recipe.requiredCookware.map(c => c.name).filter(Boolean), source: '', sourceUrl: null, photoUrl: exportPhotoUrl })}
            className="flex flex-col md:flex-row items-center gap-1 md:gap-2 btn-secondary text-sm justify-self-center border-0 bg-transparent md:border md:border-[var(--color-border-card)] md:bg-transparent"
          >
            <CalendarPlus size={18} aria-hidden />
            Add to Calendar
          </button>
          <button
            type="button"
            onClick={() => downloadCooklang({ ...recipe, ingredients: recipe.ingredients.map(i => ({ ingredientName: i.ingredientName, quantity: i.quantity, unit: i.unit })) }, recipe.slug)}
            className="flex flex-col md:flex-row items-center gap-1 md:gap-2 btn-secondary text-sm justify-self-center border-0 bg-transparent md:border md:border-[var(--color-border-card)] md:bg-transparent"
          >
            <Code size={18} aria-hidden />
            Export .cook
          </button>
        </div>
        {/* Share to Bluesky — distinct from the flat export row because
            it requires auth, renders state-aware (signed-in / dry-run /
            published / dropdown), and writes to a third-party PDS. */}
        <div className="mt-6 flex justify-center">
          <PublishToBlueskyButton
            kind="recipe"
            recipe={{
              id: recipe.id,
              title: recipe.title,
              description: recipe.description,
              instructions: recipe.instructions,
              servings: recipe.servings,
              prepTime: recipe.prepTime,
              cookTime: recipe.cookTime,
              tags: recipe.tags,
              sourceUrl: recipe.sourceUrl,
              photoUrl: recipe.photoUrl,
              createdAt: recipe.createdAt,
              groceryIngredients: recipe.groceryIngredients,
            }}
          />
        </div>
      </div>
      </article>
    </div>
  );
}

function CarrotIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-carrot (light) */}
      <path d="M504.6 138.5c-22.9-27.6-53.4-43.4-86.4-44.8-1.6-32.1-17.1-63.4-44.7-86.3-5.9-4.9-13.1-7.4-20.4-7.4-7.2 0-14.5 2.5-20.4 7.4-27.2 22.6-43.1 53-44.6 85.8-.7 14.5 1.8 28.7 6.6 42.2-13.3-4.4-26.8-7.3-40.3-7.3-48 0-94.1 26.8-116.6 72.8L2.4 478.3c-3 6.2-3.3 13.8 0 20.5 4.1 8.3 12.4 13.1 21 13.1 3.4 0 6.9-.8 10.2-2.4L311.2 374c25-12.2 46.4-32.6 59.6-59.6 15.4-31.5 16.7-66.2 6.5-97.1 11.8 4.1 23.9 6.6 36.4 6.6 34.7 0 67-15.9 90.9-44.7 9.9-11.7 9.9-28.9 0-40.7zm-162.5 162c-9.6 19.7-25.2 35.3-44.9 44.9l-124.8 60.9c-.4-.5-.6-1.1-1.1-1.6l-32-32c-6.2-6.2-16.4-6.2-22.6 0-6.2 6.2-6.2 16.4 0 22.6l25.6 25.6-100.2 49L154 240.6l26.7 26.7c3.1 3.1 7.2 4.7 11.3 4.7s8.2-1.6 11.3-4.7c6.2-6.2 6.2-16.4 0-22.6l-32-32c-.7-.7-1.7-1.1-2.5-1.7 17.1-31.5 49.4-51 85.6-51 14.9 0 29.2 3.3 42.7 9.9 23.4 11.4 41 31.3 49.5 56s6.9 51.1-4.5 74.6zM413.8 192c-21.5 0-43.1-8.9-60.6-26.5l-6.7-6.7c-37.2-37.1-35.4-92 6.6-126.8 33.2 27.5 41.5 67.6 25.3 101.6 11.2-5.3 23-8 34.9-8 24.1 0 48.3 11.1 66.7 33.3-18.3 22.1-42.3 33.1-66.2 33.1z" />
    </svg>
  );
}
