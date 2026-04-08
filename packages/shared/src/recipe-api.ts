/**
 * recipe-api.com integration.
 *
 * Wraps the recipe-api.com v1 JSON API for searching and importing recipes.
 * The API is CORS-enabled (Access-Control-Allow-Origin: *, X-API-Key is on
 * the preflight allowlist) so the browser can talk to it directly from both
 * the self-hosted app and the browser-native web PWA.
 *
 * Auth: every authenticated request carries `X-API-Key: rapi_...`.
 * Rate limits: tier-dependent — free tier is 100 req/day / 10 req/min, which
 * is strict enough that the caller MUST debounce the typeahead (we use 600ms
 * in both packages) and require a minimum query length (3 chars).
 *
 * All exported functions take `apiKey` as an argument — the shared client is
 * credential-agnostic. Callers source the key however they like:
 *   - packages/web: localStorage (bring-your-own-key)
 *   - packages/app: Rex API route that reads process.env.RECIPE_API_KEY
 */

const BASE = 'https://recipe-api.com/api/v1';

// ── API response types ──────────────────────────────────────────────────────

export interface RecipeAPICategoryCount {
  name: string;
  slug: string;
  count: number;
}

export interface RecipeAPIMeta {
  active_time: string | null;   // ISO 8601 duration (e.g. "PT20M")
  passive_time: string | null;  // ISO 8601 duration
  total_time: string | null;    // ISO 8601 duration
  overnight_required: boolean;
  yields: string | null;        // "4 servings"
  yield_count: number | null;
  serving_size_g: number | null;
}

export interface RecipeAPIDietary {
  flags: string[];
  not_suitable_for: string[];
}

export interface RecipeAPINutritionSummary {
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
}

/** Slim shape returned by GET /api/v1/recipes (search/list). */
export interface RecipeAPIListItem {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  cuisine: string | null;
  difficulty: string | null;
  tags: string[];
  meta: RecipeAPIMeta;
  dietary: RecipeAPIDietary;
  nutrition_summary: RecipeAPINutritionSummary | null;
}

export interface RecipeAPIIngredientItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  preparation: string | null;
  notes: string | null;
  substitutions: string[];
  ingredient_id: string | null;
  nutrition_source: string | null;
}

export interface RecipeAPIIngredientGroup {
  group_name: string | null;
  items: RecipeAPIIngredientItem[];
}

export interface RecipeAPIInstructionStep {
  step_number: number;
  phase: string | null;
  text: string;
  structured: {
    action: string | null;
    temperature: string | null;
    duration: string | null;  // ISO 8601
    doneness: string | null;
    [key: string]: unknown;
  } | null;
}

export interface RecipeAPIEquipmentItem {
  name: string;
  required: boolean;
  alternative: string | null;
}

/** Keyed by storage location: "refrigerator", "freezer", "pantry", etc. */
export type RecipeAPIStorage = Record<string, { notes: string | null; duration: string | null } | null | undefined>;

export interface RecipeAPITroubleshootingItem {
  symptom: string;
  likely_cause: string | null;
  prevention: string | null;
  [key: string]: unknown;
}

/** Full shape returned by GET /api/v1/recipes/{id}. */
export interface RecipeAPIRecipe {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  cuisine: string | null;
  difficulty: string | null;
  tags: string[];
  meta: RecipeAPIMeta;
  dietary: RecipeAPIDietary;
  nutrition: unknown;      // full 32-nutrient table; we don't persist yet
  ingredients: RecipeAPIIngredientGroup[];
  instructions: RecipeAPIInstructionStep[];
  equipment: RecipeAPIEquipmentItem[];
  chef_notes: string[] | null;
  cultural_context: string | null;
  storage: RecipeAPIStorage | null;
  troubleshooting: RecipeAPITroubleshootingItem[] | null;
}

export interface RecipeAPISearchParams {
  q?: string;
  category?: string;   // slug or name
  cuisine?: string;
  difficulty?: string;
  dietary?: string;
  page?: number;
  per_page?: number;
}

export interface RecipeAPIPagination {
  total: number;
  page: number;
  per_page: number;
  total_capped: boolean;
}

export interface RecipeAPISearchResponse {
  data: RecipeAPIListItem[];
  meta: RecipeAPIPagination;
}

// ── API client ──────────────────────────────────────────────────────────────

function authHeaders(apiKey: string): HeadersInit {
  return { 'X-API-Key': apiKey };
}

async function jsonOrThrow<T>(res: Response, label: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`recipe-api.com ${label} failed: ${res.status}${body ? ` — ${body.slice(0, 120)}` : ''}`);
  }
  return res.json() as Promise<T>;
}

export async function searchRecipeAPI(
  params: RecipeAPISearchParams,
  apiKey: string,
): Promise<RecipeAPISearchResponse> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') qs.set(k, String(v));
  }
  const res = await fetch(`${BASE}/recipes?${qs}`, { headers: authHeaders(apiKey) });
  return jsonOrThrow<RecipeAPISearchResponse>(res, 'search');
}

export async function getRecipeAPIRecipe(id: string, apiKey: string): Promise<RecipeAPIRecipe> {
  const res = await fetch(`${BASE}/recipes/${encodeURIComponent(id)}`, { headers: authHeaders(apiKey) });
  const wrapped = await jsonOrThrow<{ data: RecipeAPIRecipe }>(res, 'detail');
  return wrapped.data;
}

export async function getRecipeAPICategories(apiKey: string): Promise<RecipeAPICategoryCount[]> {
  const res = await fetch(`${BASE}/categories`, { headers: authHeaders(apiKey) });
  const wrapped = await jsonOrThrow<{ data: RecipeAPICategoryCount[] }>(res, 'categories');
  return wrapped.data;
}

export async function getRecipeAPICuisines(apiKey: string): Promise<RecipeAPICategoryCount[]> {
  const res = await fetch(`${BASE}/cuisines`, { headers: authHeaders(apiKey) });
  const wrapped = await jsonOrThrow<{ data: RecipeAPICategoryCount[] }>(res, 'cuisines');
  return wrapped.data;
}

// ── ParsedRecipe converter ──────────────────────────────────────────────────

export interface ParsedRecipe {
  title: string;
  description?: string;
  instructions: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
  photoUrl?: string;
  sourceUrl?: string;
  ingredients: { ingredientName: string; quantity: number | null; unit: string | null }[];
}

/**
 * Parse an ISO 8601 duration like "PT1H30M" into minutes.
 * Supports hours, minutes, and seconds (rounded up).
 * Returns 0 for null/undefined/malformed.
 */
export function parseIsoDurationMinutes(iso: string | null | undefined): number {
  if (!iso) return 0;
  const m = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (!m) return 0;
  const hours = m[1] ? parseInt(m[1], 10) : 0;
  const minutes = m[2] ? parseInt(m[2], 10) : 0;
  const seconds = m[3] ? parseInt(m[3], 10) : 0;
  return hours * 60 + minutes + Math.ceil(seconds / 60);
}

/**
 * Render an ISO 8601 duration as a short human string.
 *   "P4D" → "4 days"
 *   "P3M" → "3 months"
 *   "PT1H30M" → "1h 30m"
 *   "PT45M" → "45m"
 * Returns null for anything we can't parse so callers can omit.
 */
export function formatIsoDuration(iso: string | null | undefined): string | null {
  if (!iso) return null;
  // Date portion: P#Y#M#D
  const dateMatch = iso.match(/^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)D)?$/);
  if (dateMatch) {
    const [, y, mo, d] = dateMatch;
    const parts: string[] = [];
    if (y) parts.push(`${y} year${y === '1' ? '' : 's'}`);
    if (mo) parts.push(`${mo} month${mo === '1' ? '' : 's'}`);
    if (d) parts.push(`${d} day${d === '1' ? '' : 's'}`);
    if (parts.length) return parts.join(' ');
  }
  // Time portion: PT#H#M#S
  const timeMatch = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/);
  if (timeMatch) {
    const [, h, m, s] = timeMatch;
    const parts: string[] = [];
    if (h) parts.push(`${h}h`);
    if (m) parts.push(`${m}m`);
    if (s) parts.push(`${s}s`);
    if (parts.length) return parts.join(' ');
  }
  return null;
}

/**
 * Convert a recipe-api.com full Recipe into the Pantry Host ParsedRecipe shape.
 *
 *  - Ingredient groups are flattened. If a group has a name, it's prefixed to
 *    the first item of that group via a bracketed tag in the ingredient name
 *    so context isn't lost when rendered as a flat list.
 *  - Instructions are rendered as `1. text` lines with the doneness cue
 *    appended in italics when present.
 *  - prepTime comes from meta.active_time, cookTime from meta.passive_time
 *    (closest analogs in their schema; active = hands-on, passive = waiting).
 *  - tags combine the recipe's own tags with cuisine, difficulty, dietary
 *    flags, and a source marker.
 *  - photoUrl is always undefined — recipe-api.com does not return images.
 */
export function recipeApiToParsed(r: RecipeAPIRecipe): ParsedRecipe {
  const prepTime = parseIsoDurationMinutes(r.meta.active_time);
  const cookTime = parseIsoDurationMinutes(r.meta.passive_time);

  const ingredients: ParsedRecipe['ingredients'] = [];
  for (const group of r.ingredients) {
    for (let i = 0; i < group.items.length; i++) {
      const item = group.items[i];
      const prefix = i === 0 && group.group_name ? `[${group.group_name}] ` : '';
      const prep = item.preparation ? `, ${item.preparation}` : '';
      ingredients.push({
        ingredientName: `${prefix}${item.name}${prep}`,
        quantity: item.quantity,
        unit: item.unit,
      });
    }
  }

  // The recipe detail page at packages/{app,web}/.../RecipeDetailPage.tsx
  // renders instructions as `split('\n').map(strip-leading-number).ol()` —
  // every line becomes a numbered step. That's fine for bare sentences but
  // destroys any headings, bullets, or bold labels. So we emit ONLY the
  // numbered cook steps here and drop the rich metadata (equipment, storage,
  // chef_notes, troubleshooting) — same as we already drop nutrients.
  //
  // TODO: when Pantry Host adds first-class fields for equipment / notes /
  // storage / troubleshooting on the Recipe schema, plumb them through via
  // new ParsedRecipe fields instead of concatenating into instructions.
  const instructionLines = r.instructions
    .sort((a, b) => a.step_number - b.step_number)
    .map((s) => {
      const cue = s.structured?.doneness ? ` (${s.structured.doneness})` : '';
      return `${s.step_number}. ${s.text}${cue}`;
    });

  const tags = Array.from(
    new Set(
      [
        ...r.tags,
        r.cuisine,
        r.difficulty,
        ...r.dietary.flags,
        'recipe-api',
      ].filter((t): t is string => Boolean(t)),
    ),
  );

  return {
    title: r.name,
    description: r.description ?? undefined,
    instructions: instructionLines.join('\n'),
    servings: r.meta.yield_count ?? undefined,
    prepTime: prepTime || undefined,
    cookTime: cookTime || undefined,
    tags,
    sourceUrl: `https://recipe-api.com/recipes/${r.id}`,
    ingredients,
  };
}
