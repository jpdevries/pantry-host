import { useState, useRef, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { getFileURL } from '@/lib/storage-opfs';
import { storePhotoBlob, fetchAndStorePhoto } from '@/lib/photo-helpers';
import IngredientEditor, { resolveIngredients, type IngredientRow } from '@pantry-host/shared/components/IngredientEditor';
import FeaturedTags from '@pantry-host/shared/components/FeaturedTags';
import { extractCooklang, hasCooklangSyntax } from '@pantry-host/shared/cooklang-parser';

const RECIPE_QUERY = `query($id: String!) {
  recipe(id: $id) {
    id slug title description instructions servings prepTime cookTime
    tags requiredCookware { id name } photoUrl
    ingredients { ingredientName quantity unit sourceRecipeId }
  }
}`;

const UPDATE_MUTATION = `mutation(
  $id: String!,
  $title: String,
  $description: String,
  $instructions: String,
  $servings: Int,
  $prepTime: Int,
  $cookTime: Int,
  $tags: [String!],
  $photoUrl: String,
  $requiredCookwareIds: [String!],
  $ingredients: [RecipeIngredientInput!]
) {
  updateRecipe(
    id: $id,
    title: $title,
    description: $description,
    instructions: $instructions,
    servings: $servings,
    prepTime: $prepTime,
    cookTime: $cookTime,
    tags: $tags,
    photoUrl: $photoUrl,
    requiredCookwareIds: $requiredCookwareIds,
    ingredients: $ingredients
  ) { id slug }
}`;

async function resolveCookwareIds(input: string, existing: { id: string; name: string }[]): Promise<string[]> {
  if (!input.trim()) return [];
  const names = input.split(',').map((n) => n.trim()).filter(Boolean);
  const ids: string[] = [];
  for (const name of names) {
    const found = existing.find((c) => c.name.toLowerCase() === name.toLowerCase());
    if (found) {
      ids.push(found.id);
    } else {
      try {
        const { addCookware } = await gql<{ addCookware: { id: string } }>(
          `mutation($name: String!) { addCookware(name: $name) { id } }`,
          { name },
        );
        ids.push(addCookware.id);
      } catch { /* skip */ }
    }
  }
  return ids;
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
  requiredCookware: { id: string; name: string }[];
  photoUrl: string | null;
  ingredients: RecipeIngredient[];
}

export default function RecipeEditPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [servings, setServings] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [tags, setTags] = useState('');
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([]);
  const [ingredientError, setIngredientError] = useState<string | null>(null);
  const [allRecipes, setAllRecipes] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [cookwareInput, setCookwareInput] = useState('');
  const [cookwareItems, setCookwareItems] = useState<{ id: string; name: string }[]>([]);
  const [saving, setSaving] = useState(false);
  const cooklangDebounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Auto-extract from Cooklang syntax in instructions
  useEffect(() => {
    clearTimeout(cooklangDebounceRef.current);
    if (!hasCooklangSyntax(instructions)) return;
    cooklangDebounceRef.current = setTimeout(() => {
      const { ingredients, cookware } = extractCooklang(instructions);
      if (ingredients.length > 0) {
        setIngredientRows((prev) => {
          const extracted = ingredients.map((ing) => ({
            ingredientName: ing.name,
            quantity: ing.quantity?.toString() ?? '',
            unit: ing.unit || 'whole',
            sourceRecipeId: null,
          }));
          const extractedNames = new Set(extracted.map((e) => e.ingredientName.toLowerCase()));
          const manual = prev.filter((r) => r.ingredientName.trim() && !extractedNames.has(r.ingredientName.toLowerCase()));
          return [...extracted, ...manual];
        });
      }
      if (cookware.length > 0) {
        setCookwareInput((prev) => {
          const existing = prev.split(',').map((s) => s.trim()).filter(Boolean);
          const merged = [...new Set([...existing, ...cookware])];
          return merged.join(', ');
        });
      }
    }, 300);
    return () => clearTimeout(cooklangDebounceRef.current);
  }, [instructions]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    gql<{ cookware: { id: string; name: string }[] }>(`{ cookware { id name } }`)
      .then((d) => setCookwareItems(d.cookware))
      .catch(() => {});
    gql<{ recipes: { id: string; slug: string; title: string }[] }>(`{ recipes { id slug title } }`)
      .then((d) => setAllRecipes(d.recipes))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!slug) return;
    gql<{ recipe: Recipe | null }>(RECIPE_QUERY, { id: slug })
      .then((d) => {
        if (!d.recipe) return;
        const r = d.recipe;
        setRecipe(r);
        setTitle(r.title);
        setDescription(r.description ?? '');
        setInstructions(r.instructions);
        setServings(r.servings?.toString() ?? '');
        setPrepTime(r.prepTime?.toString() ?? '');
        setCookTime(r.cookTime?.toString() ?? '');
        setTags(r.tags.join(', '));
        setCookwareInput(r.requiredCookware.map((c) => c.name).join(', '));
        setPhotoUrl(r.photoUrl ?? '');
        setIngredientRows(
          r.ingredients.map((i) => ({
            ingredientName: i.ingredientName,
            quantity: i.quantity?.toString() ?? '',
            unit: i.unit || 'whole',
            sourceRecipeId: i.sourceRecipeId ?? null,
          }))
        );
        // Resolve photo preview
        if (r.photoUrl?.startsWith('opfs://')) {
          getFileURL(r.photoUrl.replace('opfs://', ''))
            .then(setPhotoPreview)
            .catch(() => {});
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const { path, previewUrl } = await storePhotoBlob(file, ext);
      setPhotoUrl(path);
      setPhotoPreview(previewUrl);
    } catch (err) {
      console.error('Photo upload failed:', err);
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handlePaste(e: React.ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;
        setUploadingPhoto(true);
        try {
          const { path, previewUrl } = await storePhotoBlob(file);
          setPhotoUrl(path);
          setPhotoPreview(previewUrl);
        } catch (err) {
          console.error('Paste photo failed:', err);
        } finally {
          setUploadingPhoto(false);
        }
        return;
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipe || !title.trim() || !instructions.trim()) return;

    const { ingredients, error } = resolveIngredients(ingredientRows, allRecipes);
    if (error) {
      setIngredientError(error);
      return;
    }

    setSaving(true);

    try {
      // If external URL, attempt to fetch and store in OPFS
      let finalPhotoUrl = photoUrl || null;
      if (finalPhotoUrl && !finalPhotoUrl.startsWith('opfs://')) {
        const { path } = await fetchAndStorePhoto(finalPhotoUrl);
        finalPhotoUrl = path;
      }

      const { updateRecipe } = await gql<{ updateRecipe: { slug: string } }>(UPDATE_MUTATION, {
        id: recipe.id,
        title: title.trim(),
        description: description.trim() || null,
        instructions: hasCooklangSyntax(instructions) ? extractCooklang(instructions).cleanedText : instructions.trim(),
        servings: servings ? parseInt(servings) : null,
        prepTime: prepTime ? parseInt(prepTime) : null,
        cookTime: cookTime ? parseInt(cookTime) : null,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        photoUrl: finalPhotoUrl,
        requiredCookwareIds: await resolveCookwareIds(cookwareInput, cookwareItems),
        ingredients,
      });
      navigate(`/recipes/${updateRecipe.slug}#stage`);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  const previewSrc = photoPreview || (photoUrl && !photoUrl.startsWith('opfs://') ? photoUrl : '');

  if (loading) return <div className="h-40 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />;
  if (!recipe) return <p className="text-[var(--color-text-secondary)]">Recipe not found.</p>;

  return (
    <div>
      <Link to={`/recipes/${slug}`} className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
        &larr; Back to recipe
      </Link>

      <h1 className="text-3xl font-bold mb-6">Edit Recipe</h1>

      <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-4 max-w-2xl">
        <div>
          <label className="field-label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="field-input w-full"
          />
        </div>

        <div>
          <label className="field-label">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="field-input w-full"
          />
        </div>

        {/* Photo */}
        <fieldset>
          <legend className="field-label">Photo</legend>
          <div className="space-y-3">
            <div>
              <label htmlFor="recipe-photo-url" className="sr-only">Photo URL</label>
              <input
                id="recipe-photo-url"
                type="url"
                value={photoUrl.startsWith('opfs://') ? '' : photoUrl}
                onChange={(e) => { setPhotoUrl(e.target.value); setPhotoPreview(''); }}
                placeholder="https://example.com/photo.jpg"
                className="field-input w-full"
              />
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-[var(--color-text-secondary)]">or</span>
              <input
                ref={photoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={handlePhotoUpload}
                className="sr-only"
                id="recipe-photo-file"
                aria-label="Upload photo from device"
              />
              <button
                type="button"
                onClick={() => photoInputRef.current?.click()}
                disabled={uploadingPhoto}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {uploadingPhoto ? 'Uploading\u2026' : 'Upload from device'}
              </button>
            </div>
            {previewSrc && (
              <div className="mt-2">
                <img
                  src={previewSrc}
                  alt="Recipe preview"
                  className="h-32 w-auto object-cover rounded-lg border border-[var(--color-border-card)]"
                />
              </div>
            )}
          </div>
        </fieldset>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="field-label">Servings</label>
            <input type="number" value={servings} onChange={(e) => setServings(e.target.value)} className="field-input w-full" />
          </div>
          <div>
            <label className="field-label">Prep (min)</label>
            <input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} className="field-input w-full" />
          </div>
          <div>
            <label className="field-label">Cook (min)</label>
            <input type="number" value={cookTime} onChange={(e) => setCookTime(e.target.value)} className="field-input w-full" />
          </div>
        </div>

        <div>
          <label className="field-label">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="dinner, italian, quick"
            className="field-input w-full"
          />
          <FeaturedTags tags={tags} onChange={setTags} />
        </div>

        <div>
          <label className="field-label">
            Required Cookware <span className="font-normal text-[var(--color-text-secondary)]">(comma-separated)</span>
          </label>
          {cookwareItems.length > 0 && (
            <datalist id="form-cookware">
              {cookwareItems.map((c) => <option key={c.id} value={c.name} />)}
            </datalist>
          )}
          <input
            type="text"
            list={cookwareItems.length > 0 ? 'form-cookware' : undefined}
            value={cookwareInput}
            onChange={(e) => setCookwareInput(e.target.value)}
            placeholder="e.g. Instant Pot, Cast Iron Skillet"
            className="field-input w-full"
          />
        </div>

        <IngredientEditor
          rows={ingredientRows}
          onChange={setIngredientRows}
          error={ingredientError}
          onClearError={() => setIngredientError(null)}
          recipes={allRecipes}
          defaultMode="matrix"
        />

        <div>
          <label className="field-label">Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            required
            rows={8}
            placeholder={"1. Add @olive oil{2%tbsp} to the #skillet{}\n2. Cook @garlic{3%cloves} until golden"}
            className="field-input w-full font-mono text-sm"
          />
          <p className="text-xs text-[var(--color-text-secondary)] mt-1">
            Supports <a href="https://cooklang.org" className="underline" rel="noopener noreferrer">Cooklang</a> syntax. Use <code className="text-xs">@ingredient{'{'}qty%unit{'}'}</code> and <code className="text-xs">#cookware{'{}'}</code> to auto-populate.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="btn-primary disabled:opacity-50"
          >
            {saving ? 'Saving\u2026' : 'Save Changes'}
          </button>
          <Link
            to={`/recipes/${slug}`}
            className="btn-secondary"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
