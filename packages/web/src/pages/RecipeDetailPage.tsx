import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { recipeToDataURI, downloadRecipeICS, imageToDataURI } from '@pantry-host/shared/export-recipe';
import { downloadCooklang, stepPhotoBaseUrl } from '@pantry-host/shared/cooklang';
import { getFileURL } from '@/lib/storage-opfs';
import { PencilSimple, Trash, Printer, CalendarPlus, Export, Code, ShareNetwork } from '@phosphor-icons/react';

interface RecipeIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
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
  createdAt: string;
}

const RECIPE_QUERY = `query($id: String!) {
  recipe(id: $id) {
    id slug title description instructions servings prepTime cookTime
    tags requiredCookware { name } photoUrl sourceUrl queued createdAt
    ingredients { ingredientName quantity unit }
  }
}`;

function StepPhotos({ instructions, sourceUrl }: { instructions: string; sourceUrl: string | null }) {
  const base = sourceUrl ? stepPhotoBaseUrl(sourceUrl) : null;
  if (!base) return null;

  const steps = instructions.split(/\n+/).filter((l) => /^\d+\./.test(l.trim()));
  if (steps.length === 0) return null;

  return (
    <div className="mt-10">
      <h2 className="text-xl font-bold mb-4">Step by Step</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
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
                onError={(e) => { (e.target as HTMLImageElement).closest('.card')!.style.display = 'none'; }}
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

  if (loading) return <div className="h-40 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />;
  if (!recipe) return <p className="text-[var(--color-text-secondary)]">Recipe not found.</p>;

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
            <div className="flex gap-1 items-center">
              <span className="text-xs text-[var(--color-text-secondary)] mr-1">Delete?</span>
              <button type="button" autoFocus onClick={handleDelete} className="btn-danger text-xs px-2 py-1" style={{ minHeight: 'auto' }}>Yes</button>
              <button type="button" onClick={() => setDeleteConfirm(false)} className="btn-secondary text-xs px-2 py-1" style={{ minHeight: 'auto' }}>No</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setDeleteConfirm(true)}
              className="text-[var(--color-text-secondary)] hover:text-red-500 p-2"
              aria-label="Delete"
            >
              <Trash size={16} aria-hidden />
            </button>
          )}
        </div>
      </div>

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
        {recipe.servings != null && (
          <div>
            <dt className="font-semibold text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-0.5">Servings</dt>
            <dd>{recipe.servings}</dd>
          </div>
        )}
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
            <ul className="space-y-2 legible">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>
                  {ing.quantity != null && <span className="font-semibold tabular-nums">{ing.quantity}</span>}
                  {ing.unit && <span className="text-[var(--color-text-secondary)]"> {ing.unit}</span>}
                  {' '}{ing.ingredientName}
                </li>
              ))}
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

      <div className="py-16">
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
    </div>
  );
}
