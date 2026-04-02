import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { recipeToDataURI, downloadRecipeICS, imageToDataURI } from '@pantry-host/shared/export-recipe';

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
  queued: boolean;
  ingredients: RecipeIngredient[];
  createdAt: string;
}

const RECIPE_QUERY = `query($id: String!) {
  recipe(id: $id) {
    id slug title description instructions servings prepTime cookTime
    tags requiredCookware { name } queued createdAt
    ingredients { ingredientName quantity unit }
  }
}`;

export default function RecipeDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [exportPhotoUrl, setExportPhotoUrl] = useState<string | null>(null);

  // Resolve local upload photos to base64 data URIs for export
  useEffect(() => {
    const photoUrl = recipe?.photoUrl;
    if (!photoUrl) { setExportPhotoUrl(null); return; }
    if (!photoUrl.startsWith('/uploads/')) {
      setExportPhotoUrl(photoUrl);
      return;
    }
    const uuid = photoUrl.replace(/^\/uploads\//, '').replace(/\.\w+$/, '');
    imageToDataURI(`/uploads/${uuid}-400.jpg`)
      .then(setExportPhotoUrl)
      .catch(() => setExportPhotoUrl(null));
  }, [recipe?.photoUrl]);

  useEffect(() => {
    if (!slug) return;
    gql<{ recipe: Recipe | null }>(RECIPE_QUERY, { id: slug })
      .then((d) => setRecipe(d.recipe))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleDelete() {
    if (!recipe || !confirm('Delete this recipe?')) return;
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

      <h1
        className="text-3xl font-bold mb-2"
      >
        {recipe.title}
      </h1>

      {recipe.description && (
        <p className="text-[var(--color-text-secondary)] mb-4">{recipe.description}</p>
      )}

      <div className="flex gap-2 mb-6">
        <button
          onClick={handleToggleQueue}
          className="add-to-list-cta px-3 py-1.5 rounded-lg text-sm"
        >
          {recipe.queued ? 'Remove from list' : 'Add to grocery list'}
        </button>
        <button
          onClick={handleDelete}
          className="px-3 py-1.5 rounded-lg text-sm border border-red-300 text-red-600 hover:underline"
          aria-label="Delete"
        >
          Delete
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5">
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

        <div className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5">
          <h2 className="font-semibold mb-3">Details</h2>
          <dl className="space-y-1.5 text-sm">
            {recipe.servings && <div><dt className="inline font-medium">Servings:</dt> <dd className="inline">{recipe.servings}</dd></div>}
            {recipe.prepTime && <div><dt className="inline font-medium">Prep:</dt> <dd className="inline">{recipe.prepTime} min</dd></div>}
            {recipe.cookTime && <div><dt className="inline font-medium">Cook:</dt> <dd className="inline">{recipe.cookTime} min</dd></div>}
          </dl>
          {recipe.tags.length > 0 && (
            <div className="flex gap-1.5 mt-3 flex-wrap">
              {recipe.tags.map((tag) => (
                <span key={tag} className="text-xs px-2 py-0.5 rounded-full bg-[var(--color-accent-subtle)] text-[var(--color-text-secondary)]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5">
        <h2 className="font-semibold mb-3">Instructions</h2>
        <div className="text-sm whitespace-pre-wrap leading-relaxed">{recipe.instructions}</div>
      </div>

      <div className="mt-6">
        <h2 className="font-semibold mb-3">Share the Love</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border-card)] hover:underline"
          >
            Print
          </button>
          <a
            href={recipeToDataURI({ ...recipe, requiredCookware: recipe.requiredCookware.map(c => c.name).filter(Boolean), source: '', sourceUrl: null, photoUrl: exportPhotoUrl })}
            download={`${recipe.slug || 'recipe'}.html`}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border-card)] hover:underline"
          >
            Export HTML
          </a>
          <button
            type="button"
            onClick={() => downloadRecipeICS({ ...recipe, requiredCookware: recipe.requiredCookware.map(c => c.name).filter(Boolean), source: '', sourceUrl: null, photoUrl: exportPhotoUrl })}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm border border-[var(--color-border-card)] hover:underline"
          >
            Add to Calendar
          </button>
        </div>
        <p className="text-sm text-[var(--color-text-secondary)] mt-3">Print this recipe, export it as HTML to share with a friend, or add it to your calendar for meal planning.</p>
      </div>
    </div>
  );
}
