import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import { UNIT_GROUPS, COMMON_INGREDIENTS } from '@/lib/constants';
import { gql } from '@/lib/gql';

interface RecipeIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  sourceRecipeId?: string | null;
}

interface RecipeData {
  id?: string;
  title?: string;
  description?: string;
  instructions?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
  requiredCookware?: string[];
  photoUrl?: string;
  ingredients?: RecipeIngredient[];
}

interface ExistingRecipe {
  id: string;
  title: string;
  source: string;
}

interface Props {
  initial?: RecipeData;
  existingRecipes?: ExistingRecipe[]; // for recipe-as-ingredient picker
  cookwareItems?: string[]; // for Required Cookware datalist
  recipesBase?: string; // e.g. '/recipes' or '/kitchens/grandmas/recipes'
  kitchenSlug?: string; // for createRecipe mutation
}

const CREATE_RECIPE = `
  mutation CreateRecipe(
    $title: String!, $description: String, $instructions: String!,
    $servings: Int, $prepTime: Int, $cookTime: Int,
    $tags: [String!], $requiredCookware: [String!], $photoUrl: String,
    $sourceUrl: String,
    $ingredients: [RecipeIngredientInput!]!, $kitchenSlug: String
  ) {
    createRecipe(
      title: $title, description: $description, instructions: $instructions,
      servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
      tags: $tags, requiredCookware: $requiredCookware, photoUrl: $photoUrl,
      sourceUrl: $sourceUrl,
      ingredients: $ingredients, kitchenSlug: $kitchenSlug
    ) { id }
  }
`;

const UPDATE_RECIPE = `
  mutation UpdateRecipe(
    $id: String!, $title: String, $description: String, $instructions: String,
    $servings: Int, $prepTime: Int, $cookTime: Int,
    $tags: [String!], $requiredCookware: [String!], $photoUrl: String,
    $ingredients: [RecipeIngredientInput!]
  ) {
    updateRecipe(
      id: $id, title: $title, description: $description, instructions: $instructions,
      servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
      tags: $tags, requiredCookware: $requiredCookware, photoUrl: $photoUrl,
      ingredients: $ingredients
    ) { id }
  }
`;

type IngredientRow = {
  ingredientName: string;
  quantity: string;
  unit: string;
  sourceRecipeId: string | null; // null = plain ingredient, string = another recipe's id
};

export default function RecipeForm({ initial, existingRecipes = [], cookwareItems = [], recipesBase = '/recipes', kitchenSlug }: Props) {
  const router = useRouter();
  const editing = Boolean(initial?.id);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [servings, setServings] = useState<string>((initial?.servings ?? 2).toString());
  const [prepTime, setPrepTime] = useState<string>(initial?.prepTime?.toString() ?? '');
  const [cookTime, setCookTime] = useState<string>(initial?.cookTime?.toString() ?? '');
  const [tagInput, setTagInput] = useState(initial?.tags?.join(', ') ?? '');
  const [cookwareInput, setCookwareInput] = useState(initial?.requiredCookware?.join(', ') ?? '');
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? '');
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>(
    initial?.ingredients?.map((i) => ({
      ingredientName: i.ingredientName,
      quantity: i.quantity?.toString() ?? '',
      unit: i.unit ?? 'whole',
      sourceRecipeId: i.sourceRecipeId ?? null,
    })) ?? [{ ingredientName: '', quantity: '', unit: 'whole', sourceRecipeId: null }],
  );

  const [importUrl, setImportUrl] = useState('');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const ingredientListRef = useRef<HTMLUListElement>(null);
  const [focusNewRecipeSelect, setFocusNewRecipeSelect] = useState(false);

  useEffect(() => {
    if (!focusNewRecipeSelect || !ingredientListRef.current) return;
    setFocusNewRecipeSelect(false);
    requestAnimationFrame(() => {
      const lastLi = ingredientListRef.current?.lastElementChild;
      const select = lastLi?.querySelector<HTMLSelectElement>('select');
      select?.focus();
    });
  }, [focusNewRecipeSelect, ingredientRows]);

  // ---- URL import ----
  async function handleImport() {
    if (!importUrl.trim()) return;
    setImporting(true);
    setImportError(null);
    try {
      const proto = window.location.protocol === 'https:' ? 'https' : 'http';
      const port = proto === 'https' ? 4444 : 4001;
      const res = await fetch(`${proto}://${window.location.hostname}:${port}/fetch-recipe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: importUrl.trim() }),
      });
      const data = await res.json() as {
        title?: string; description?: string; instructions?: string; servings?: number;
        prepTime?: number; cookTime?: number; tags?: string[]; requiredCookware?: string[]; photoUrl?: string;
        ingredients?: { ingredientName: string; quantity: number | null; unit: string | null }[];
        error?: string;
      };

      if (!res.ok || data.error) throw new Error(data.error ?? 'Unknown error');

      if (data.title) setTitle(data.title);
      if (data.description) setDescription(data.description);
      if (data.instructions) setInstructions(data.instructions);
      if (data.servings) setServings(data.servings.toString());
      if (data.prepTime) setPrepTime(data.prepTime.toString());
      if (data.cookTime) setCookTime(data.cookTime.toString());
      if (data.tags?.length) setTagInput(data.tags.join(', '));
      if (data.requiredCookware?.length) setCookwareInput(data.requiredCookware.join(', '));
      if (data.photoUrl) setPhotoUrl(data.photoUrl);
      if (data.ingredients?.length) {
        setIngredientRows(
          data.ingredients.map((i) => {
            let name = i.ingredientName;
            if (i.quantity != null) {
              // Strip leading quantity number from name if it was already parsed out
              // e.g. "3 chopped, pitted dates" with qty 3 → "chopped, pitted dates"
              const prefix = new RegExp(`^${i.quantity}\\s+`);
              name = name.replace(prefix, '');
            }
            return {
              ingredientName: name,
              quantity: i.quantity?.toString() ?? '',
              unit: i.unit ?? 'whole',
              sourceRecipeId: null,
            };
          }),
        );
      }
    } catch (err) {
      setImportError((err as Error).message);
    } finally {
      setImporting(false);
    }
  }

  // ---- Photo upload ----
  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) setPhotoUrl(data.url);
    } catch {
      // ignore upload error — user can still paste URL
    } finally {
      setUploadingPhoto(false);
    }
  }

  // ---- Ingredients ----
  function updateIngredient(idx: number, patch: Partial<IngredientRow>) {
    setIngredientRows((prev) => prev.map((r, i) => {
      if (i !== idx) return r;
      const updated = { ...r, ...patch };
      // Auto-detect: if ingredientName exactly matches a recipe title, link it
      if ('ingredientName' in patch && !('sourceRecipeId' in patch)) {
        const match = existingRecipes.find(
          (rec) => rec.title.toLowerCase() === updated.ingredientName.toLowerCase(),
        );
        updated.sourceRecipeId = match?.id ?? null;
      }
      return updated;
    }));
  }

  function addIngredient() {
    setIngredientRows((prev) => [...prev, { ingredientName: '', quantity: '', unit: 'whole', sourceRecipeId: null }]);
  }

  function addRecipeIngredient() {
    setIngredientRows((prev) => [...prev, { ingredientName: '', quantity: '1', unit: 'whole', sourceRecipeId: '' }]);
    setFocusNewRecipeSelect(true);
  }

  function removeIngredient(idx: number) {
    setIngredientRows((prev) => prev.filter((_, i) => i !== idx));
  }

  // ---- Submit ----
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !instructions.trim()) return;
    setSaving(true);
    setError(null);

    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
    const requiredCookware = cookwareInput.split(',').map((t) => t.trim()).filter(Boolean);
    const ingredients = ingredientRows
      .filter((r) => r.sourceRecipeId ? true : r.ingredientName.trim())
      .map((r) => ({
        ingredientName: r.sourceRecipeId
          ? (existingRecipes.find((rec) => rec.id === r.sourceRecipeId)?.title ?? r.ingredientName.trim())
          : r.ingredientName.trim(),
        quantity: r.quantity ? parseFloat(r.quantity) : null,
        unit: r.unit || null,
        sourceRecipeId: r.sourceRecipeId || null,
      }));

    try {
      if (editing && initial?.id) {
        await gql(UPDATE_RECIPE, {
          id: initial.id,
          title: title.trim(),
          description: description || null,
          instructions: instructions.trim(),
          servings: servings ? parseInt(servings) : 2,
          prepTime: prepTime ? parseInt(prepTime) : null,
          cookTime: cookTime ? parseInt(cookTime) : null,
          tags,
          requiredCookware,
          photoUrl: photoUrl || null,
          ingredients,
        });
        router.push(`${recipesBase}/${initial.id}#stage`);
      } else {
        const data = await gql<{ createRecipe: { id: string } }>(CREATE_RECIPE, {
          title: title.trim(),
          description: description || null,
          instructions: instructions.trim(),
          servings: servings ? parseInt(servings) : 2,
          prepTime: prepTime ? parseInt(prepTime) : null,
          cookTime: cookTime ? parseInt(cookTime) : null,
          tags,
          requiredCookware,
          photoUrl: photoUrl || null,
          sourceUrl: importUrl.trim() || null,
          ingredients,
          kitchenSlug: kitchenSlug ?? null,
        });
        router.push(`${recipesBase}/${data.createRecipe.id}#stage`);
      }
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label={editing ? 'Edit recipe' : 'Add recipe'} noValidate>
      <datalist id="form-ingredients">
        {COMMON_INGREDIENTS.map((i) => <option key={i} value={i} />)}
        {existingRecipes.map((r) => <option key={r.id} value={r.title} />)}
      </datalist>

      {/* URL Import */}
      {!editing && (
        <section aria-labelledby="import-heading" className="mb-8 p-5 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
          <h2 id="import-heading" className="text-sm font-bold uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-3">
            Import from URL
          </h2>
          <div className="flex gap-2 flex-wrap">
            <div className="flex-1 min-w-0">
              <label htmlFor="import-url" className="sr-only">Recipe URL</label>
              <input
                id="import-url"
                type="url"
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://example.com/recipe"
                className="field-input w-full"
                aria-describedby={importError ? 'import-error' : undefined}
              />
            </div>
            <button
              type="button"
              onClick={handleImport}
              disabled={importing || !importUrl.trim()}
              aria-busy={importing}
              className="btn-secondary disabled:opacity-50"
            >
              {importing ? 'Fetching…' : 'Import'}
            </button>
          </div>
          {importError && (
            <p id="import-error" role="alert" className="mt-2 text-sm text-red-600 dark:text-red-400">
              {importError}
            </p>
          )}
        </section>
      )}

      {/* Title */}
      <div className="mb-5">
        <label htmlFor="recipe-title" className="field-label">
          Title <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <input
          id="recipe-title"
          type="text"
          required
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="field-input w-full"
          aria-required="true"
        />
      </div>

      {/* Description */}
      <div className="mb-5">
        <label htmlFor="recipe-description" className="field-label">Description</label>
        <textarea
          id="recipe-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={2}
          className="field-input w-full resize-y"
        />
      </div>

      {/* Time & servings */}
      <fieldset className="mb-5">
        <legend className="field-label">Servings &amp; Time</legend>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label htmlFor="recipe-servings" className="sr-only">Servings</label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400" aria-hidden="true">Servings</span>
              <input
                id="recipe-servings"
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(e.target.value)}
                className="field-input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="recipe-prep" className="sr-only">Prep time (minutes)</label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400" aria-hidden="true">Prep (min)</span>
              <input
                id="recipe-prep"
                type="number"
                min="0"
                value={prepTime}
                onChange={(e) => setPrepTime(e.target.value)}
                className="field-input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="recipe-cook" className="sr-only">Cook time (minutes)</label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-zinc-500 dark:text-zinc-400" aria-hidden="true">Cook (min)</span>
              <input
                id="recipe-cook"
                type="number"
                min="0"
                value={cookTime}
                onChange={(e) => setCookTime(e.target.value)}
                className="field-input"
              />
            </div>
          </div>
        </div>
      </fieldset>

      {/* Ingredients */}
      <fieldset className="mb-5">
        <legend className="field-label">Ingredients</legend>
        <ul ref={ingredientListRef} role="list" className="space-y-2 mb-3">
          {ingredientRows.map((row, idx) => {
            const isRecipeMode = row.sourceRecipeId !== null;
            return (
              <li key={idx} className="flex gap-2 items-start flex-wrap sm:flex-nowrap">
                {/* Name input or recipe selector */}
                {isRecipeMode ? (
                  <select
                    value={row.sourceRecipeId ?? ''}
                    onChange={(e) => updateIngredient(idx, { sourceRecipeId: e.target.value || null })}
                    aria-label={`Ingredient ${idx + 1}: select recipe`}
                    className="field-select flex-1"
                  >
                    <option value="" disabled>Choose a recipe…</option>
                    {recipeOptionGroups(existingRecipes)}
                  </select>
                ) : (
                  <input
                    type="text"
                    list="form-ingredients"
                    value={row.ingredientName}
                    onChange={(e) => updateIngredient(idx, { ingredientName: e.target.value })}
                    placeholder="Ingredient"
                    aria-label={`Ingredient ${idx + 1} name`}
                    className="field-input flex-1"
                  />
                )}

                <input
                  type="number"
                  min="0"
                  step="any"
                  value={row.quantity}
                  onChange={(e) => updateIngredient(idx, { quantity: e.target.value })}
                  placeholder="Qty"
                  aria-label={`Ingredient ${idx + 1} quantity`}
                  className="field-input w-20"
                />
                <select
                  value={row.unit}
                  onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                  aria-label={`Ingredient ${idx + 1} unit`}
                  className="field-select w-28"
                >
                  {UNIT_GROUPS.map((g) => (
                    <optgroup key={g.label} label={g.label}>
                      {g.units.map((u) => <option key={u} value={u}>{u}</option>)}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => removeIngredient(idx)}
                  aria-label={`Remove ingredient ${idx + 1}`}
                  disabled={ingredientRows.length === 1}
                  className="mt-1.5 text-zinc-400 hover:text-red-500 p-2 disabled:opacity-30"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </li>
            );
          })}
        </ul>
        <div className="flex gap-3">
          <button type="button" onClick={addIngredient} className="btn-secondary text-sm">
            + Add ingredient
          </button>
          {existingRecipes.length > 0 && (
            <button type="button" onClick={addRecipeIngredient} className="btn-secondary text-sm">
              + Add recipe as ingredient
            </button>
          )}
        </div>
      </fieldset>

      {/* Instructions */}
      <div className="mb-5">
        <label htmlFor="recipe-instructions" className="field-label">
          Instructions <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-1">
          Each line is one step. Start lines with a number for best formatting.
        </p>
        <textarea
          id="recipe-instructions"
          required
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={8}
          className="field-input w-full resize-y font-mono text-sm"
          aria-required="true"
        />
      </div>

      {/* Tags */}
      <div className="mb-5">
        <label htmlFor="recipe-tags" className="field-label">
          Tags <span className="font-normal text-zinc-500">(comma-separated)</span>
        </label>
        <input
          id="recipe-tags"
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="e.g. quick, kid-friendly, vegetarian"
          className="field-input w-full"
        />
      </div>

      {/* Required cookware */}
      <div className="mb-5">
        <label htmlFor="recipe-cookware" className="field-label">
          Required Cookware <span className="font-normal text-zinc-500">(comma-separated)</span>
        </label>
        {cookwareItems.length > 0 && (
          <datalist id="form-cookware">
            {cookwareItems.map((c) => <option key={c} value={c} />)}
          </datalist>
        )}
        <input
          id="recipe-cookware"
          type="text"
          list={cookwareItems.length > 0 ? 'form-cookware' : undefined}
          value={cookwareInput}
          onChange={(e) => setCookwareInput(e.target.value)}
          placeholder="e.g. Instant Pot, Cast Iron Skillet"
          className="field-input w-full"
        />
      </div>

      {/* Photo */}
      <fieldset className="mb-6">
        <legend className="field-label">Photo</legend>
        <div className="space-y-3">
          <div>
            <label htmlFor="recipe-photo-url" className="sr-only">Photo URL</label>
            <input
              id="recipe-photo-url"
              type="url"
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
              placeholder="https://example.com/photo.jpg"
              className="field-input w-full"
            />
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">or</span>
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
              className="btn-secondary text-sm"
            >
              {uploadingPhoto ? 'Uploading…' : 'Upload from device'}
            </button>
          </div>
          {photoUrl && (
            <div className="mt-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="Recipe preview" className="h-32 w-auto object-cover border border-zinc-200 dark:border-zinc-700" />
            </div>
          )}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !title.trim() || !instructions.trim()}
          aria-busy={saving}
          className="btn-primary flex-1 md:flex-none disabled:opacity-50"
        >
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Save Recipe'}
        </button>
        <a href={`${recipesBase}#stage`} className="btn-secondary">Cancel</a>
      </div>
    </form>
  );
}

const SOURCE_LABELS: Record<string, string> = {
  'ai-generated': 'AI-generated',
  'imported': 'Imported',
  'url-import': 'Imported',
  'manual': 'Manual',
};

function recipeOptionGroups(recipes: ExistingRecipe[]) {
  const manual: ExistingRecipe[] = [];
  const groups = new Map<string, ExistingRecipe[]>();
  for (const r of recipes) {
    const key = r.source || 'manual';
    if (key === 'manual') { manual.push(r); continue; }
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  manual.sort((a, b) => a.title.localeCompare(b.title));
  for (const list of groups.values()) list.sort((a, b) => a.title.localeCompare(b.title));
  const sorted = [...groups.entries()].sort((a, b) =>
    (SOURCE_LABELS[a[0]] ?? a[0]).localeCompare(SOURCE_LABELS[b[0]] ?? b[0]),
  );
  return (
    <>
      {manual.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
      {sorted.map(([source, list]) => (
        <optgroup key={source} label={SOURCE_LABELS[source] ?? source}>
          {list.map((r) => <option key={r.id} value={r.id}>{r.title}</option>)}
        </optgroup>
      ))}
    </>
  );
}
