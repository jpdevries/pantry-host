import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Camera, X } from '@phosphor-icons/react';
import { gql } from '@/lib/gql';
import { storePhotoBlob, fetchAndStorePhoto } from '@/lib/photo-helpers';
import IngredientEditor, { resolveIngredients, type IngredientRow } from '@pantry-host/shared/components/IngredientEditor';
import FeaturedTags from '@pantry-host/shared/components/FeaturedTags';
import { extractCooklang, hasCooklangSyntax, updateCooklangIngredient, parseCooklangMetadata } from '@pantry-host/shared/cooklang-parser';

const CREATE_MUTATION = `mutation(
  $title: String!,
  $description: String,
  $instructions: String!,
  $servings: Int,
  $prepTime: Int,
  $cookTime: Int,
  $tags: [String!],
  $photoUrl: String,
  $stepPhotos: [String!],
  $requiredCookwareIds: [String!],
  $ingredients: [RecipeIngredientInput!]!
) {
  createRecipe(
    title: $title,
    description: $description,
    instructions: $instructions,
    servings: $servings,
    prepTime: $prepTime,
    cookTime: $cookTime,
    tags: $tags,
    photoUrl: $photoUrl,
    stepPhotos: $stepPhotos,
    requiredCookwareIds: $requiredCookwareIds,
    ingredients: $ingredients
  ) { id slug }
}`;

/** Resolve cookware names to IDs with fuzzy matching, auto-creating any that don't exist */
async function resolveCookwareIds(input: string, existing: { id: string; name: string; tags: string[] }[]): Promise<string[]> {
  if (!input.trim()) return [];
  const names = input.split(',').map((n) => n.trim()).filter(Boolean);
  const ids: string[] = [];
  for (const name of names) {
    const lower = name.toLowerCase();
    // 1. Exact name match
    let found = existing.find((c) => c.name.toLowerCase() === lower);
    // 2. Substring — cookware name contains the search term
    if (!found) found = existing.find((c) => c.name.toLowerCase().includes(lower));
    // 3. Tag match
    if (!found) found = existing.find((c) => c.tags?.some((t) => t.toLowerCase() === lower));
    if (found) {
      ids.push(found.id);
    } else {
      // Auto-create
      try {
        const { addCookware } = await gql<{ addCookware: { id: string } }>(
          `mutation($name: String!) { addCookware(name: $name) { id } }`,
          { name },
        );
        ids.push(addCookware.id);
      } catch { /* skip on error */ }
    }
  }
  return ids;
}

export default function RecipeNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [cooklangMode, setCooklangMode] = useState<'save' | 'runtime'>('runtime');
  const [instructionsFocused, setInstructionsFocused] = useState(false);
  const [ingredientsFocused, setIngredientsFocused] = useState(false);
  const [servings, setServings] = useState('2');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [tags, setTags] = useState('');
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([
    { ingredientName: '', quantity: '', unit: 'whole', sourceRecipeId: null },
  ]);
  const [ingredientError, setIngredientError] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [stepPhotos, setStepPhotos] = useState<string[]>([]);
  const [stepPreviews, setStepPreviews] = useState<string[]>([]);
  const [uploadingStepIdx, setUploadingStepIdx] = useState<number | null>(null);
  const [cookwareInput, setCookwareInput] = useState('');
  const [cookwareItems, setCookwareItems] = useState<{ id: string; name: string; tags: string[] }[]>([]);
  const [allRecipes, setAllRecipes] = useState<{ id: string; slug: string; title: string }[]>([]);
  const [pantryIngredients, setPantryIngredients] = useState<{ name: string; quantity: number | null; unit: string | null }[]>([]);
  const [saving, setSaving] = useState(false);
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
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cooklangDebounceRef = useRef<ReturnType<typeof setTimeout>>();
  const suppressExtraction = useRef(false);
  // Track which fields the user has manually touched — metadata only auto-fills clean fields
  const dirtyFields = useRef(new Set<string>());

  // Auto-extract ingredients + cookware + metadata from Cooklang syntax in instructions
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
      // Auto-populate form fields from Cooklang >> metadata (only untouched fields)
      const meta = parseCooklangMetadata(instructions);
      if (meta.title && !dirtyFields.current.has('title')) setTitle(meta.title);
      if (meta.servings && !dirtyFields.current.has('servings')) setServings(meta.servings.toString());
      if (meta.prepTime && !dirtyFields.current.has('prepTime')) setPrepTime(meta.prepTime.toString());
      if (meta.cookTime && !dirtyFields.current.has('cookTime')) setCookTime(meta.cookTime.toString());
      if (meta.tags?.length && !dirtyFields.current.has('tags')) setTags(meta.tags.join(', '));
    }, 300);
    return () => clearTimeout(cooklangDebounceRef.current);
  }, [instructions]);

  // Reverse sync: ingredient editor changes → update Cooklang in instructions
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

  useEffect(() => {
    gql<{ cookware: { id: string; name: string; tags: string[] }[] }>(`{ cookware { id name tags } }`)
      .then((d) => setCookwareItems(d.cookware))
      .catch(() => {});
    gql<{ recipes: { id: string; slug: string; title: string }[] }>(`{ recipes { id slug title } }`)
      .then((d) => setAllRecipes(d.recipes))
      .catch(() => {});
    gql<{ ingredients: { name: string; quantity: number | null; unit: string | null }[] }>(`{ ingredients { name quantity unit } }`)
      .then((d) => setPantryIngredients(d.ingredients))
      .catch(() => {});
  }, []);

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

  // Auto-generate step photo slots from numbered instruction lines
  // Count steps: any non-empty line that isn't Cooklang metadata (>>)
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
    setStepPreviews((prev) => {
      if (prev.length === instructionStepCount) return prev;
      if (prev.length < instructionStepCount)
        return [...prev, ...Array(instructionStepCount - prev.length).fill('')];
      return prev.slice(0, instructionStepCount);
    });
  }, [instructionStepCount]);

  async function handleStepPhotoUpload(idx: number, file: File) {
    setUploadingStepIdx(idx);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const { path, previewUrl } = await storePhotoBlob(file, ext);
      setStepPhotos((prev) => { const n = [...prev]; n[idx] = path; return n; });
      setStepPreviews((prev) => { const n = [...prev]; n[idx] = previewUrl; return n; });
    } catch (err) {
      console.error('Step photo upload failed:', err);
    } finally {
      setUploadingStepIdx(null);
    }
  }

  function removeStepPhoto(idx: number) {
    setStepPhotos((prev) => { const n = [...prev]; n[idx] = ''; return n; });
    setStepPreviews((prev) => { const n = [...prev]; n[idx] = ''; return n; });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !instructions.trim()) return;

    // Resolve @slug references and validate
    const { ingredients, error } = resolveIngredients(ingredientRows, allRecipes);
    if (error) {
      setIngredientError(error);
      return;
    }

    setSaving(true);

    try {
      let finalPhotoUrl = photoUrl || null;
      if (finalPhotoUrl && !finalPhotoUrl.startsWith('opfs://')) {
        const { path } = await fetchAndStorePhoto(finalPhotoUrl);
        finalPhotoUrl = path;
      }

      const { createRecipe } = await gql<{ createRecipe: { slug: string } }>(CREATE_MUTATION, {
        title: title.trim(),
        description: description.trim() || null,
        instructions: cooklangMode === 'save' && hasCooklangSyntax(instructions) ? extractCooklang(instructions).cleanedText : instructions.trim(),
        servings: servings ? parseInt(servings) : null,
        prepTime: prepTime ? parseInt(prepTime) : null,
        cookTime: cookTime ? parseInt(cookTime) : null,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        photoUrl: finalPhotoUrl,
        stepPhotos: stepPhotos.some((s) => s) ? stepPhotos : null,
        requiredCookwareIds: await resolveCookwareIds(cookwareInput, cookwareItems),
        ingredients,
      });
      navigate(`/recipes/${createRecipe.slug}#stage`);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  const previewSrc = photoPreview || (photoUrl && !photoUrl.startsWith('opfs://') ? photoUrl : '');

  return (
    <div>
      <Link to="/recipes#stage" className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
        &larr; Back to recipes
      </Link>

      <h1 className="text-3xl font-bold mb-6">New Recipe</h1>

      <form onSubmit={handleSubmit} onPaste={handlePaste} className="space-y-4 max-w-2xl">
        <div>
          <label className="field-label">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => { dirtyFields.current.add('title'); setTitle(e.target.value); }}
            placeholder={placeholderRecipe.title}
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
            placeholder={placeholderRecipe.description}
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
            <input type="number" value={servings} onChange={(e) => { dirtyFields.current.add('servings'); setServings(e.target.value); }} className="field-input w-full" />
          </div>
          <div>
            <label className="field-label">Prep (min)</label>
            <input type="number" value={prepTime} onChange={(e) => { dirtyFields.current.add('prepTime'); setPrepTime(e.target.value); }} className="field-input w-full" />
          </div>
          <div>
            <label className="field-label">Cook (min)</label>
            <input type="number" value={cookTime} onChange={(e) => { dirtyFields.current.add('cookTime'); setCookTime(e.target.value); }} className="field-input w-full" />
          </div>
        </div>

        <div>
          <label className="field-label">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => { dirtyFields.current.add('tags'); setTags(e.target.value); }}
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

        <div
          onFocus={() => setIngredientsFocused(true)}
          onBlur={() => setIngredientsFocused(false)}
          {...(instructionsFocused && hasCooklangSyntax(instructions) ? { inert: '', 'aria-disabled': true, style: { opacity: 0.5 } } : {})}
        >
          <IngredientEditor
            rows={ingredientRows}
            onChange={handleIngredientChange}
            error={ingredientError}
            onClearError={() => setIngredientError(null)}
            recipes={allRecipes}
          />
        </div>

        <div>
          <div {...(ingredientsFocused && hasCooklangSyntax(instructions) ? { inert: '', 'aria-disabled': true, style: { opacity: 0.5 } } : {})}>
          <label className="field-label">Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            onFocus={() => setInstructionsFocused(true)}
            onBlur={() => setInstructionsFocused(false)}
            required
            rows={8}
            placeholder={"1. Add @olive oil{2%tbsp} to the #skillet{}\n2. Cook @garlic{3%cloves} until golden\n3. Toss with @pasta{200%g}"}
            className="field-input w-full font-mono text-sm"
          />
          <details open className="mt-2 text-xs text-[var(--color-text-secondary)]">
            <summary className="cursor-pointer hover:underline">
              Supports <a href="https://cooklang.org" className="underline" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>Cooklang</a> syntax
            </summary>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
              {/* Ingredients column */}
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
              {/* Cookware column */}
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
              {/* Recipes column */}
              <div>
                <p className="font-sans font-semibold text-[var(--color-text-primary)] mb-1">Sub-recipes</p>
                <p className="mb-0.5 text-[var(--color-text-secondary)]">@recipe-slug</p>
                <ul className="space-y-0.5">
                  {(allRecipes.length > 0
                    ? allRecipes.slice(0, 3).map((r) => (
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
              <input type="radio" name="cooklang-mode" value="runtime" checked={cooklangMode === 'runtime'} onChange={() => setCooklangMode('runtime')} className="accent-[var(--color-accent)]" />
              At runtime
            </label>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer">
              <input type="radio" name="cooklang-mode" value="save" checked={cooklangMode === 'save'} onChange={() => setCooklangMode('save')} className="accent-[var(--color-accent)]" />
              On save
            </label>
          </fieldset>
          </div>
        </div>

        {/* Step by Step Photos — auto-generated from numbered instruction lines */}
        <fieldset className={stepPhotos.length === 0 ? 'hidden' : ''}>
            <legend className="field-label">
              Step by Step Photos
            </legend>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
              {stepPhotos.map((url, i) => {
                const preview = stepPreviews[i];
                const hasPhoto = !!(url || preview);
                return (
                  <div
                    key={i}
                    className={`card aspect-square relative flex items-center justify-center overflow-hidden ${
                      !hasPhoto ? 'border-2 border-dashed border-[var(--color-text-secondary)] bg-[var(--color-bg-card)]' : ''
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
                    {hasPhoto ? (
                      <>
                        <img
                          src={preview || url}
                          alt={`Step ${i + 1}`}
                          className="absolute inset-0 w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => removeStepPhoto(i)}
                          className="absolute top-1.5 right-1.5 p-1 rounded-full bg-[var(--color-bg-body)] text-[var(--color-text-secondary)] hover:text-[var(--color-danger)] z-10"
                          aria-label={`Remove step ${i + 1} photo`}
                        >
                          <X size={14} weight="bold" aria-hidden />
                        </button>
                      </>
                    ) : (
                      <label className="flex flex-col items-center gap-1 cursor-pointer p-4 text-center">
                        <Camera size={24} weight="light" className="text-[var(--color-text-secondary)]" aria-hidden />
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
                );
              })}
            </div>
          </fieldset>

        <button
          type="submit"
          disabled={saving}
          className="btn-primary disabled:opacity-50 mt-8"
        >
          {saving ? 'Saving\u2026' : 'Create recipe'}
        </button>
      </form>
    </div>
  );
}
