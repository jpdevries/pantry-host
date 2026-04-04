import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { recipeToDataURI, downloadRecipeICS, imageToDataURI } from '@pantry-host/shared/export-recipe';
import { downloadCooklang, stepPhotoBaseUrl } from '@pantry-host/shared/cooklang';
import { getFileURL } from '@/lib/storage-opfs';
import { PencilSimple, Trash, Printer, CalendarPlus, Export, Code } from '@phosphor-icons/react';

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
  const [loadedSteps, setLoadedSteps] = useState<Set<number>>(new Set());
  const base = sourceUrl ? stepPhotoBaseUrl(sourceUrl) : null;
  if (!base) return null;

  const steps = instructions.split(/\n+/).filter((l) => /^\d+\./.test(l.trim()));
  if (steps.length === 0) return null;

  const hasAnyPhotos = loadedSteps.size > 0;

  return (
    <div className={`mt-6 ${hasAnyPhotos ? '' : 'hidden'}`}>
      <h2 className="font-semibold mb-3">Step by Step</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {steps.map((step, i) => {
          const stepNum = i + 1;
          const photoUrl = `${encodeURI(base)}.${stepNum}.jpg`;
          const stepText = step.replace(/^\d+\.\s*/, '');
          return (
            <div
              key={stepNum}
              className={`card rounded-xl overflow-hidden ${loadedSteps.has(stepNum) ? '' : 'hidden'}`}
            >
              <img
                src={photoUrl}
                alt={`Step ${stepNum}`}
                className="w-full aspect-[4/3] object-cover"
                loading="lazy"
                onLoad={() => setLoadedSteps((prev) => new Set(prev).add(stepNum))}
                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
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

  return (
    <div>
      <Link to="/recipes" className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
        &larr; Back to recipes
      </Link>

      {displayPhotoUrl && (
        <div className="mb-4">
          <img
            src={displayPhotoUrl}
            alt={recipe.title}
            className="w-full max-h-72 object-cover rounded-xl border border-[var(--color-border-card)]"
          />
        </div>
      )}

      <h1 className="text-3xl font-bold mb-2">{recipe.title}</h1>

      {recipe.description && (
        <p className="text-[var(--color-text-secondary)] mb-4">{recipe.description}</p>
      )}

      <div className="flex items-center gap-2 mb-6">
        <button
          onClick={handleToggleQueue}
          className={`add-to-list-cta px-3 py-1.5 rounded-lg text-sm${recipe.queued ? ' is-active' : ''}`}
        >
          {recipe.queued ? 'Remove from list' : 'Add to grocery list'}
        </button>
        <div className="flex gap-2 ml-auto">
          <Link
            to={`/recipes/${slug}/edit`}
            className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-2"
            aria-label="Edit"
          >
            <PencilSimple size={16} aria-hidden />
          </Link>
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

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card rounded-xl p-5">
          <h2 className="font-semibold mb-3">Ingredients</h2>
          {recipe.ingredients.length === 0 ? (
            <p className="text-sm text-[var(--color-text-secondary)]">No ingredients listed.</p>
          ) : (
            <ul className="space-y-1.5 text-sm">
              {recipe.ingredients.map((ing, i) => (
                <li key={i}>
                  {ing.quantity != null && <span className="font-medium">{ing.quantity}</span>}
                  {ing.unit && <span className="text-[var(--color-text-secondary)]"> {ing.unit}</span>}
                  {' '}{ing.ingredientName}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card rounded-xl p-5">
          <h2 className="font-semibold mb-3">Details</h2>
          <dl className="space-y-1.5 text-sm">
            {recipe.servings && <div><dt className="inline font-medium">Servings:</dt> <dd className="inline">{recipe.servings}</dd></div>}
            {recipe.prepTime && <div><dt className="inline font-medium">Prep:</dt> <dd className="inline">{recipe.prepTime} min</dd></div>}
            {recipe.cookTime && <div><dt className="inline font-medium">Cook:</dt> <dd className="inline">{recipe.cookTime} min</dd></div>}
          </dl>
          {recipe.tags.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {recipe.tags.map((tag) => (
                <span key={tag} className="tag">{tag}</span>
              ))}
            </div>
          )}
          {recipe.sourceUrl && (
            <p className="mt-3 text-xs text-[var(--color-text-secondary)]">
              Source: <a href={recipe.sourceUrl} className="underline" rel="noopener noreferrer" target="_blank">{recipe.sourceUrl.includes('github.com') ? recipe.sourceUrl.replace('https://github.com/', '').split('/').slice(0, 2).join('/') : new URL(recipe.sourceUrl).hostname}</a>
            </p>
          )}
        </div>
      </div>

      <div className="mt-6 card rounded-xl p-5">
        <h2 className="font-semibold mb-3">Instructions</h2>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{recipe.instructions}</div>
      </div>

      <StepPhotos instructions={recipe.instructions} sourceUrl={recipe.sourceUrl} />

      <div className="mt-6">
        <h2 className="font-semibold mb-3">Share the Love</h2>
        <div className="flex gap-2">
          <button type="button" onClick={() => window.print()} className="btn-secondary text-sm">
            <Printer size={16} aria-hidden /> Print
          </button>
          <a
            href={recipeToDataURI({ ...recipe, requiredCookware: recipe.requiredCookware.map(c => c.name).filter(Boolean), source: '', sourceUrl: null, photoUrl: exportPhotoUrl })}
            download={`${recipe.slug || 'recipe'}.html`}
            className="btn-secondary text-sm"
          >
            <Export size={16} aria-hidden /> Export HTML
          </a>
          <button
            type="button"
            onClick={() => downloadRecipeICS({ ...recipe, requiredCookware: recipe.requiredCookware.map(c => c.name).filter(Boolean), source: '', sourceUrl: null, photoUrl: exportPhotoUrl })}
            className="btn-secondary text-sm"
          >
            <CalendarPlus size={16} aria-hidden /> Add to Calendar
          </button>
          <button
            type="button"
            onClick={() => downloadCooklang({ ...recipe, ingredients: recipe.ingredients.map(i => ({ ingredientName: i.ingredientName, quantity: i.quantity, unit: i.unit })) }, recipe.slug)}
            className="btn-secondary text-sm"
          >
            <Code size={16} aria-hidden /> Export .cook
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-3 legible pretty">Print this recipe, export it as HTML, add it to your calendar, or export as a Cooklang .cook file.</p>
      </div>
    </div>
  );
}
