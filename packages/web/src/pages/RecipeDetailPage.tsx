import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { recipeToDataURI, downloadRecipeICS, imageToDataURI } from '@pantry-host/shared/export-recipe';
import { downloadCooklang, stepPhotoBaseUrl } from '@pantry-host/shared/cooklang';
import { getFileURL } from '@/lib/storage-opfs';
import { PencilSimple, Trash, Printer, CalendarPlus, Export, Code, ShareNetwork, Rows, Columns, GridNine, ArrowsOut, ArrowsIn } from '@phosphor-icons/react';

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
  requiredCookware: { name: string }[];
  photoUrl: string | null;
  sourceUrl: string | null;
  queued: boolean;
  ingredients: RecipeIngredient[];
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
    tags requiredCookware { name } photoUrl sourceUrl queued createdAt
    ingredients { ingredientName quantity unit sourceRecipeId }
    usedIn { id slug title cookTime prepTime servings tags photoUrl }
  }
}`;

const GRID_OPTIONS = [
  { cols: 3, Icon: GridNine, label: '3 columns' },
  { cols: 2, Icon: Columns, label: '2 columns' },
  { cols: 1, Icon: Rows, label: '1 column' },
] as const;

function StepPhotos({ instructions, sourceUrl }: { instructions: string; sourceUrl: string | null }) {
  const [gridCols, setGridCols] = useState(3);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const errorCount = useRef(0);
  const base = sourceUrl ? stepPhotoBaseUrl(sourceUrl) : null;
  if (!base) return null;

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
          const photoUrl = `${encodeURI(base)}.${stepNum}.jpg`;
          const stepText = step.replace(/^\d+\.\s*/, '');
          return (
            <div key={stepNum} className="card rounded-xl overflow-hidden">
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

export default function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportPhotoUrl, setExportPhotoUrl] = useState<string | null>(null);
  const [displayPhotoUrl, setDisplayPhotoUrl] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [checkedIngredients, setCheckedIngredients] = useState<Set<number>>(new Set());
  const [subRecipes, setSubRecipes] = useState<SubRecipe[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [supportsFullscreen, setSupportsFullscreen] = useState(false);
  const [servings, setServings] = useState(2);
  const articleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSupportsFullscreen(Boolean(document.documentElement.requestFullscreen || (document.documentElement as any).webkitRequestFullscreen));
    function onFSChange() { setIsFullscreen(Boolean(document.fullscreenElement)); }
    document.addEventListener('fullscreenchange', onFSChange);
    return () => document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

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
  const steps = recipe.instructions.split('\n').map((s) => s.replace(/^\d+\.\s*/, '').trim()).filter(Boolean);

  return (
    <div>
      {/* Action bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-4 mb-6 border-b" style={{ borderColor: 'var(--color-border-card)' }}>
        <Link to="/recipes" className="text-sm text-[var(--color-text-secondary)] hover:underline">
          &larr; Recipes
        </Link>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          <button
            onClick={handleToggleQueue}
            className={`btn-secondary text-sm${recipe.queued ? ' border-[var(--color-accent)] text-[var(--color-accent)]' : ''}`}
          >
            {recipe.queued ? '- Grocery List' : '+ Grocery List'}
          </button>
          <Link to={`/recipes/${slug}/edit`} className="btn-secondary text-sm">Edit</Link>
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
        className="zen-exit-btn fixed top-4 right-4 z-50 bg-black/70 hover:bg-black/90 text-white p-2 rounded-full backdrop-blur transition-colors hidden outline outline-1 outline-current"
      >
        <ArrowsIn size={18} aria-hidden />
      </button>

      {/* Photo */}
      {displayPhotoUrl && (
        <div className="mb-8 aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
          <img
            src={displayPhotoUrl}
            alt={recipe.title}
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {/* Tags above title */}
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {recipe.tags.map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}

      {/* Title */}
      <h1 className="text-4xl font-bold mb-4">{recipe.title}</h1>

      {/* Description */}
      {recipe.description && (
        <p className="text-lg text-[var(--color-text-secondary)] leading-relaxed max-w-prose mb-5">{recipe.description}</p>
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
              <span key={c.name} className="tag">{c.name}</span>
            ))}
          </div>
        </div>
      )}

      {/* Source */}
      {recipe.sourceUrl && (
        <p className="mt-4 text-xs text-[var(--color-text-secondary)]">
          Source: <a href={recipe.sourceUrl} className="underline" rel="noopener noreferrer" target="_blank">{recipe.sourceUrl.includes('github.com') ? recipe.sourceUrl.replace('https://github.com/', '').split('/').slice(0, 2).join('/') : new URL(recipe.sourceUrl).hostname}</a>
        </p>
      )}

      {/* Two-column: Ingredients | Instructions */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_2fr] gap-10 mt-10">
        <section>
          <h2 className="text-xl font-bold mb-4">Ingredients</h2>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No ingredients listed.</p>
          ) : (
            <ul role="list" className="space-y-2 legible">
              {recipe.ingredients.map((ing, i) => {
                const checked = checkedIngredients.has(i);
                return (
                  <li key={i}>
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => setCheckedIngredients((prev) => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; })}
                        aria-label={ing.ingredientName}
                        className="mt-1 w-5 h-5 border-2 border-[var(--color-border-card)] accent-[var(--color-accent)] shrink-0"
                      />
                      <span className={checked ? 'line-through text-[var(--color-text-secondary)]' : ''}>
                        {scaleQty(ing.quantity) != null && <span className="font-semibold tabular-nums">{scaleQty(ing.quantity)}{' '}</span>}
                        {ing.unit && <span>{ing.unit} </span>}
                        {ing.ingredientName}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-xl font-bold mb-4">Instructions</h2>
          <ol className="space-y-6 legible">
            {steps.map((step, idx) => (
              <li key={idx} className="flex items-baseline gap-4">
                <span className="shrink-0 w-8 text-right text-sm tabular-nums text-[var(--color-text-secondary)] select-none" aria-hidden="true">{idx + 1}.</span>
                <p className="leading-relaxed">{step}</p>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <StepPhotos instructions={recipe.instructions} sourceUrl={recipe.sourceUrl} />

      {subRecipes.length > 0 && (
        <section className="mt-12">
          <h2 className="text-xl font-bold mb-4">Made from Scratch</h2>
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
            {subRecipes.map((r) => (
              <Link key={r.id} to={`/recipes/${r.slug || r.id}`} className="card rounded-xl overflow-hidden hover:underline">
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
              <Link key={r.id} to={`/recipes/${r.slug || r.id}`} className="card rounded-xl overflow-hidden hover:underline">
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
      </div>
      </article>
    </div>
  );
}
