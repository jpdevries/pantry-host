import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/router';
import { UNIT_GROUPS, COMMON_INGREDIENTS } from '@pantry-host/shared/constants';
import IngredientEditor, { resolveIngredients, type IngredientRow } from '@pantry-host/shared/components/IngredientEditor';
import { extractCooklang, hasCooklangSyntax, updateCooklangIngredient, parseCooklangMetadata } from '@pantry-host/shared/cooklang-parser';
import { gql } from '@/lib/gql';
import { enqueue } from '@/lib/offlineQueue';

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
  stepPhotos?: string[];
  ingredients?: RecipeIngredient[];
}

interface ExistingRecipe {
  id: string;
  slug?: string | null;
  title: string;
  source: string;
}

interface Props {
  initial?: RecipeData;
  existingRecipes?: ExistingRecipe[]; // for recipe-as-ingredient picker
  cookwareItems?: { id: string; name: string; tags: string[] }[]; // for Required Cookware datalist
  allTags?: string[]; // for tag typeahead suggestions
  recipesBase?: string; // e.g. '/recipes' or '/kitchens/grandmas/recipes'
  kitchenSlug?: string; // for createRecipe mutation
}

const CREATE_RECIPE = `
  mutation CreateRecipe(
    $title: String!, $description: String, $instructions: String!,
    $servings: Int, $prepTime: Int, $cookTime: Int,
    $tags: [String!], $requiredCookwareIds: [String!], $photoUrl: String,
    $stepPhotos: [String!], $sourceUrl: String,
    $ingredients: [RecipeIngredientInput!]!, $kitchenSlug: String
  ) {
    createRecipe(
      title: $title, description: $description, instructions: $instructions,
      servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
      tags: $tags, requiredCookwareIds: $requiredCookwareIds, photoUrl: $photoUrl,
      stepPhotos: $stepPhotos, sourceUrl: $sourceUrl,
      ingredients: $ingredients, kitchenSlug: $kitchenSlug
    ) { id }
  }
`;

const UPDATE_RECIPE = `
  mutation UpdateRecipe(
    $id: String!, $title: String, $description: String, $instructions: String,
    $servings: Int, $prepTime: Int, $cookTime: Int,
    $tags: [String!], $requiredCookwareIds: [String!], $photoUrl: String,
    $stepPhotos: [String!], $ingredients: [RecipeIngredientInput!]
  ) {
    updateRecipe(
      id: $id, title: $title, description: $description, instructions: $instructions,
      servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
      tags: $tags, requiredCookwareIds: $requiredCookwareIds, photoUrl: $photoUrl,
      stepPhotos: $stepPhotos, ingredients: $ingredients
    ) { id }
  }
`;

type IngredientRow = {
  ingredientName: string;
  quantity: string;
  unit: string;
  sourceRecipeId: string | null; // null = plain ingredient, string = another recipe's id
};

export default function RecipeForm({ initial, existingRecipes = [], cookwareItems = [], allTags = [], recipesBase = '/recipes', kitchenSlug }: Props) {
  const router = useRouter();
  const editing = Boolean(initial?.id);

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [instructions, setInstructions] = useState(initial?.instructions ?? '');
  const [cooklangMode, setCooklangMode] = useState<'save' | 'runtime'>('runtime');
  const [servings, setServings] = useState<string>((initial?.servings ?? 2).toString());
  const [prepTime, setPrepTime] = useState<string>(initial?.prepTime?.toString() ?? '');
  const [cookTime, setCookTime] = useState<string>(initial?.cookTime?.toString() ?? '');
  const [tagInput, setTagInput] = useState(initial?.tags?.join(', ') ?? '');
  const [cookwareInput, setCookwareInput] = useState(initial?.requiredCookware?.join(', ') ?? '');
  const [photoUrl, setPhotoUrl] = useState(initial?.photoUrl ?? '');
  const [stepPhotos, setStepPhotos] = useState<string[]>(initial?.stepPhotos ?? []);
  const [uploadingStepIdx, setUploadingStepIdx] = useState<number | null>(null);
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
  const [pantryIngredients, setPantryIngredients] = useState<{ name: string; quantity: number | null; unit: string | null }[]>([]);

  const photoInputRef = useRef<HTMLInputElement>(null);
  const cooklangDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const suppressExtraction = useRef(false);
  // On edit pages, fields are pre-filled → mark dirty so metadata doesn't overwrite
  const dirtyFields = useRef(new Set<string>(editing ? ['title', 'servings', 'prepTime', 'cookTime', 'tags'] : []));
  const placeholderRecipe = useMemo(() => {
    const examples = [
      { title: 'Cucumber Salad', description: 'Crisp, cool, and ready in minutes' },
      { title: 'Mango Avocado Bowl', description: 'Tropical and creamy with a lime kick' },
      { title: 'Roasted Cauliflower Tacos', description: 'Smoky, spiced, and completely plant-based' },
      { title: 'Lemon Herb Hummus', description: 'Smooth chickpea dip with fresh herbs' },
      { title: 'Thai Peanut Noodles', description: 'Rich peanut sauce over rice noodles' },
      { title: 'Watermelon Gazpacho', description: 'Chilled summer soup with a hint of mint' },
      { title: 'Sweet Potato Black Bean Chili', description: 'Hearty one-pot comfort food' },
      { title: 'Coconut Curry Lentils', description: 'Warming spices with creamy coconut milk' },
    ];
    return examples[Math.floor(Math.random() * examples.length)];
  }, []);

  useEffect(() => {
    gql<{ ingredients: { name: string; quantity: number | null; unit: string | null }[] }>(
      `query($kitchenSlug: String) { ingredients(kitchenSlug: $kitchenSlug) { name quantity unit } }`,
      { kitchenSlug: kitchenSlug ?? 'home' },
    ).then((d) => setPantryIngredients(d.ingredients)).catch(() => {});
  }, [kitchenSlug]);

  // Auto-extract from Cooklang syntax in instructions
  useEffect(() => {
    clearTimeout(cooklangDebounceRef.current);
    if (suppressExtraction.current) { suppressExtraction.current = false; return; }
    if (!hasCooklangSyntax(instructions) && !instructions.includes('>>')) return;
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
      const meta = parseCooklangMetadata(instructions);
      if (meta.title && !dirtyFields.current.has('title')) setTitle(meta.title);
      if (meta.servings && !dirtyFields.current.has('servings')) setServings(meta.servings.toString());
      if (meta.prepTime && !dirtyFields.current.has('prepTime')) setPrepTime(meta.prepTime.toString());
      if (meta.cookTime && !dirtyFields.current.has('cookTime')) setCookTime(meta.cookTime.toString());
      if (meta.tags?.length && !dirtyFields.current.has('tags')) setTagInput(meta.tags.join(', '));
    }, 300);
    return () => clearTimeout(cooklangDebounceRef.current);
  }, [instructions]);

  function handleIngredientChange(rows: IngredientRow[]) {
    setIngredientRows(rows);
    if (!hasCooklangSyntax(instructions)) return;
    let updated = instructions;
    for (const row of rows) {
      if (!row.ingredientName.trim()) continue;
      updated = updateCooklangIngredient(updated, row.ingredientName, row.quantity || null, row.unit || null);
    }
    if (updated !== instructions) {
      suppressExtraction.current = true;
      setInstructions(updated);
    }
  }

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
      const port = proto === 'https' ? 4443 : 4001;
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

  // ---- Step Photos ----
  const instructionStepCount = useMemo(() =>
    instructions.split('\n').filter((l) => {
      const t = l.trim();
      return t.length > 0 && !t.startsWith('>>');
    }).length,
    [instructions],
  );

  useEffect(() => {
    setStepPhotos((prev) => {
      if (prev.length === instructionStepCount) return prev;
      if (prev.length < instructionStepCount)
        return [...prev, ...Array(instructionStepCount - prev.length).fill('')];
      return prev.slice(0, instructionStepCount);
    });
  }, [instructionStepCount]);

  async function handleStepPhotoUpload(idx: number, file: File) {
    setUploadingStepIdx(idx);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch('/api/upload', { method: 'POST', body: fd });
      const data = await res.json() as { url?: string; error?: string };
      if (data.url) {
        setStepPhotos((prev) => { const n = [...prev]; n[idx] = data.url!; return n; });
      }
    } catch { /* ignore */ }
    finally { setUploadingStepIdx(null); }
  }

  function removeStepPhoto(idx: number) {
    setStepPhotos((prev) => { const n = [...prev]; n[idx] = ''; return n; });
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
    // Resolve cookware names to IDs (fuzzy: exact → substring → tag), auto-creating missing ones
    const requiredCookwareIds: string[] = [];
    for (const name of cookwareInput.split(',').map((n) => n.trim()).filter(Boolean)) {
      const lower = name.toLowerCase();
      let found = cookwareItems.find((c) => c.name.toLowerCase() === lower);
      if (!found) found = cookwareItems.find((c) => c.name.toLowerCase().includes(lower));
      if (!found) found = cookwareItems.find((c) => c.tags?.some((t) => t.toLowerCase() === lower));
      if (found) { requiredCookwareIds.push(found.id); }
      else {
        try {
          const { addCookware } = await gql<{ addCookware: { id: string } }>(
            `mutation($name: String!, $kitchenSlug: String) { addCookware(name: $name, kitchenSlug: $kitchenSlug) { id } }`,
            { name, kitchenSlug },
          );
          requiredCookwareIds.push(addCookware.id);
        } catch { /* skip */ }
      }
    }
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

    if (editing && initial?.id) {
      const variables = {
        id: initial.id,
        title: title.trim(),
        description: description || null,
        instructions: cooklangMode === 'save' && hasCooklangSyntax(instructions) ? extractCooklang(instructions).cleanedText : instructions.trim(),
        servings: servings ? parseInt(servings) : 2,
        prepTime: prepTime ? parseInt(prepTime) : null,
        cookTime: cookTime ? parseInt(cookTime) : null,
        tags,
        requiredCookwareIds,
        photoUrl: photoUrl || null,
        stepPhotos: stepPhotos.some((s) => s) ? stepPhotos : null,
        ingredients,
      };
      try {
        await gql(UPDATE_RECIPE, variables);
      } catch {
        enqueue(UPDATE_RECIPE, variables);
      }
      router.push(`${recipesBase}/${initial.id}#stage`);
    } else {
      const variables = {
        title: title.trim(),
        description: description || null,
        instructions: cooklangMode === 'save' && hasCooklangSyntax(instructions) ? extractCooklang(instructions).cleanedText : instructions.trim(),
        servings: servings ? parseInt(servings) : 2,
        prepTime: prepTime ? parseInt(prepTime) : null,
        cookTime: cookTime ? parseInt(cookTime) : null,
        tags,
        requiredCookwareIds,
        photoUrl: photoUrl || null,
        stepPhotos: stepPhotos.some((s) => s) ? stepPhotos : null,
        sourceUrl: importUrl.trim() || null,
        ingredients,
        kitchenSlug: kitchenSlug ?? null,
      };
      try {
        const data = await gql<{ createRecipe: { id: string } }>(CREATE_RECIPE, variables);
        router.push(`${recipesBase}/${data.createRecipe.id}#stage`);
      } catch {
        enqueue(CREATE_RECIPE, variables);
        // No ID available offline — navigate to recipes list
        router.push(recipesBase);
      }
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
        <section aria-labelledby="import-heading" className="mb-8 p-5 border border-[var(--color-border-card)] bg-[var(--color-bg-card)]">
          <h2 id="import-heading" className="text-sm font-bold uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
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
          onChange={(e) => { dirtyFields.current.add('title'); setTitle(e.target.value); }}
          placeholder={placeholderRecipe.title}
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
          placeholder={placeholderRecipe.description}
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
              <span className="text-xs text-[var(--color-text-secondary)]" aria-hidden="true">Servings</span>
              <input
                id="recipe-servings"
                type="number"
                min="1"
                value={servings}
                onChange={(e) => { dirtyFields.current.add('servings'); setServings(e.target.value); }}
                className="field-input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="recipe-prep" className="sr-only">Prep time (minutes)</label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-secondary)]" aria-hidden="true">Prep (min)</span>
              <input
                id="recipe-prep"
                type="number"
                min="0"
                value={prepTime}
                onChange={(e) => { dirtyFields.current.add('prepTime'); setPrepTime(e.target.value); }}
                className="field-input"
              />
            </div>
          </div>
          <div>
            <label htmlFor="recipe-cook" className="sr-only">Cook time (minutes)</label>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-[var(--color-text-secondary)]" aria-hidden="true">Cook (min)</span>
              <input
                id="recipe-cook"
                type="number"
                min="0"
                value={cookTime}
                onChange={(e) => { dirtyFields.current.add('cookTime'); setCookTime(e.target.value); }}
                className="field-input"
              />
            </div>
          </div>
        </div>
      </fieldset>

      {/* Ingredients */}
      <div className="mb-5">
        <IngredientEditor
          rows={ingredientRows}
          onChange={handleIngredientChange}
          error={error}
          onClearError={() => setError(null)}
          recipes={existingRecipes.map((r) => ({ id: r.id, slug: r.slug ?? r.id, title: r.title }))}
          defaultMode="matrix"
        />
      </div>

      {/* Instructions */}
      <div className="mb-5">
        <label htmlFor="recipe-instructions" className="field-label">
          Instructions <span aria-hidden="true" className="text-red-500">*</span>
        </label>
        <textarea
          id="recipe-instructions"
          required
          value={instructions}
          onChange={(e) => setInstructions(e.target.value)}
          rows={8}
          placeholder={"1. Add @olive oil{2%tbsp} to the #skillet{}\n2. Cook @garlic{3%cloves} until golden\n3. Toss with @pasta{200%g}"}
          className="field-input w-full resize-y font-mono text-sm"
          aria-required="true"
        />
        <details open className="text-xs text-[var(--color-text-secondary)] mt-1">
          <summary className="cursor-pointer hover:underline">
            Supports <a href="https://cooklang.org" className="underline" rel="noopener noreferrer" onClick={(e: React.MouseEvent) => e.stopPropagation()}>Cooklang</a> syntax
          </summary>
          <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
            <div>
              <p className="font-sans font-semibold text-[var(--color-text-primary)] mb-1">Ingredients</p>
              <p className="mb-0.5 text-[var(--color-text-secondary)]">@name{'{'}qty%unit{'}'}</p>
              <ul className="space-y-0.5">
                {(pantryIngredients.length > 0
                  ? pantryIngredients.filter((i) => i.quantity && i.unit).slice(0, 3).map((i) => (
                      <li key={i.name}>@{i.name.toLowerCase()}{'{'}{ i.quantity}%{i.unit}{'}'}</li>
                    ))
                  : [
                      <li key="f">@flour{'{'}2%cup{'}'}</li>,
                      <li key="g">@garlic{'{'}3%cloves{'}'}</li>,
                      <li key="o">@olive oil{'{'}1%tbsp{'}'}</li>,
                    ]
                )}
              </ul>
            </div>
            <div>
              <p className="font-sans font-semibold text-[var(--color-text-primary)] mb-1">Cookware</p>
              <p className="mb-0.5 text-[var(--color-text-secondary)]">#name{'{}'}</p>
              <ul className="space-y-0.5">
                {(cookwareItems.length > 0
                  ? cookwareItems.slice(0, 3).map((c) => (
                      <li key={c.id}>#{c.name.toLowerCase().replace(/\s+/g, ' ')}{'{}'}</li>
                    ))
                  : [
                      <li key="s">#skillet{'{}'}</li>,
                      <li key="o">#oven{'{}'}</li>,
                    ]
                )}
              </ul>
            </div>
            <div>
              <p className="font-sans font-semibold text-[var(--color-text-primary)] mb-1">Sub-recipes</p>
              <p className="mb-0.5 text-[var(--color-text-secondary)]">@recipe-slug</p>
              <ul className="space-y-0.5">
                {(existingRecipes.length > 0
                  ? existingRecipes.filter((r) => r.slug).slice(0, 3).map((r) => (
                      <li key={r.id}>@{r.slug}</li>
                    ))
                  : [
                      <li key="j">@raspberry-jam</li>,
                    ]
                )}
              </ul>
            </div>
          </div>
        </details>
        <fieldset className="flex items-center gap-4 mt-2">
          <legend className="text-xs font-semibold text-[var(--color-text-secondary)]">Process Cooklang</legend>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input type="radio" name="cooklang-mode" value="runtime" checked={cooklangMode === 'runtime'} onChange={() => setCooklangMode('runtime')} className="accent-accent" />
            At runtime
          </label>
          <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
            <input type="radio" name="cooklang-mode" value="save" checked={cooklangMode === 'save'} onChange={() => setCooklangMode('save')} className="accent-accent" />
            On save
          </label>
        </fieldset>
      </div>

      {/* Step by Step Photos */}
      <fieldset className={stepPhotos.length === 0 ? 'hidden' : 'mb-6'}>
          <legend className="field-label">
            Step by Step Photos
          </legend>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {stepPhotos.map((url, i) => (
              <div
                key={i}
                className={`card aspect-square relative flex items-center justify-center overflow-hidden ${
                  !url ? 'border-2 border-dashed border-[var(--color-text-secondary)] bg-[var(--color-bg-card)]' : ''
                }`}
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('ring-2', 'ring-[var(--color-accent)]'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('ring-2', 'ring-[var(--color-accent)]'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('ring-2', 'ring-[var(--color-accent)]');
                  const file = e.dataTransfer.files?.[0];
                  if (file?.type.startsWith('image/')) handleStepPhotoUpload(i, file);
                }}
              >
                <span className="absolute top-1.5 left-2 text-xs font-medium text-[var(--color-text-secondary)] z-10">
                  Step {i + 1}
                </span>
                {uploadingStepIdx === i && (
                  <div className="absolute inset-0 bg-[var(--color-bg-body)] opacity-70 flex items-center justify-center z-20">
                    <span className="text-sm text-[var(--color-text-secondary)]">Uploading…</span>
                  </div>
                )}
                {url ? (
                  <>
                    <img
                      src={url.startsWith('/uploads/') ? url.replace(/\.\w+$/, '-400.jpg') : url}
                      alt={`Step ${i + 1}`}
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeStepPhoto(i)}
                      className="absolute top-1.5 right-1.5 p-1 rounded-full bg-[var(--color-bg-body)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] z-10"
                      aria-label={`Remove step ${i + 1} photo`}
                    >
                      ✕
                    </button>
                  </>
                ) : (
                  <label className="flex flex-col items-center gap-1 cursor-pointer p-4 text-center">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-xs text-[var(--color-text-secondary)]">Click or drag</span>
                    <input
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleStepPhotoUpload(i, file);
                      }}
                      className="sr-only"
                      aria-label={`Upload step ${i + 1} photo`}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>
        </fieldset>

      {/* Tags */}
      <div className="mb-5">
        <label htmlFor="recipe-tags" className="field-label">Tags</label>
        {allTags.length > 0 && (
          <datalist id="form-tags">
            {allTags
              .filter((t) => !tagInput.split(',').map((s) => s.trim().toLowerCase()).includes(t.toLowerCase()))
              .map((t) => <option key={t} value={t} />)}
          </datalist>
        )}
        <input
          id="recipe-tags"
          type="text"
          list={allTags.length > 0 ? 'form-tags' : undefined}
          value={tagInput}
          onChange={(e) => { dirtyFields.current.add('tags'); setTagInput(e.target.value); }}
          placeholder="e.g. quick, kid-friendly, vegetarian"
          className="field-input w-full"
        />
        <p className="text-xs text-[var(--color-text-secondary)] mt-1">Comma-separated. Type to see suggestions.</p>
        <label className="flex items-center gap-2 mt-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tagInput.split(',').map((t) => t.trim().toLowerCase()).includes('gluten-free')}
            onChange={(e) => {
              const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
              if (e.target.checked) {
                if (!tags.some((t) => t.toLowerCase() === 'gluten-free')) {
                  setTagInput([...tags, 'gluten-free'].join(', '));
                }
              } else {
                setTagInput(tags.filter((t) => t.toLowerCase() !== 'gluten-free').join(', '));
              }
            }}
            className="w-4 h-4 accent-accent"
          />
          <span className="text-sm">Gluten-free</span>
        </label>
        {['pregnancy-safe', 'breastfeeding-safe', 'lactation', 'breastfeeding-alert'].map((tag) => (
          <label key={tag} className="flex items-center gap-2 mt-2 cursor-pointer">
            <input
              type="checkbox"
              checked={tagInput.split(',').map((t) => t.trim().toLowerCase()).includes(tag)}
              onChange={(e) => {
                const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
                if (e.target.checked) {
                  if (!tags.some((t) => t.toLowerCase() === tag)) {
                    setTagInput([...tags, tag].join(', '));
                  }
                } else {
                  setTagInput(tags.filter((t) => t.toLowerCase() !== tag).join(', '));
                }
              }}
              className="w-4 h-4 accent-accent"
            />
            <span className="text-sm">
              {tag === 'pregnancy-safe' ? 'Pregnancy safe' :
               tag === 'breastfeeding-safe' ? 'Breastfeeding safe' :
               tag === 'lactation' ? 'Supports lactation' :
               'Breastfeeding alert'}
            </span>
          </label>
        ))}
      </div>

      {/* Required cookware */}
      <div className="mb-5">
        <label htmlFor="recipe-cookware" className="field-label">
          Required Cookware <span className="font-normal text-[var(--color-text-secondary)]">(comma-separated)</span>
        </label>
        {cookwareItems.length > 0 && (
          <datalist id="form-cookware">
            {cookwareItems.map((c) => <option key={c.id} value={c.name} />)}
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
              className="btn-secondary text-sm"
            >
              {uploadingPhoto ? 'Uploading…' : 'Upload from device'}
            </button>
          </div>
          {photoUrl && (
            <div className="mt-2">
              <img
                src={photoUrl.startsWith('/uploads/') ? photoUrl.replace(/\.\w+$/, '-400.jpg') : photoUrl}
                alt="Recipe preview"
                className="h-32 w-auto object-cover border border-[var(--color-border-card)]"
                width={227}
                height={128}
              />
            </div>
          )}
        </div>
      </fieldset>

      {error && (
        <p role="alert" className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <div className="flex gap-3 mt-8">
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
