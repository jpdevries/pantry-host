/**
 * Cooklang Federation integration.
 *
 * Wraps the recipes.cooklang.org JSON API for searching and importing
 * federated recipes, and provides export to .cook format.
 *
 * API: CORS open (access-control-allow-origin: *), works from browser.
 * Rate limit: ~60 req/min.
 */

const FEDERATION_BASE = 'https://recipes.cooklang.org';

// ── API response types ────────────────────────────────────────────────────────

export interface FederationSearchResult {
  id: number;
  title: string;
  summary: string | null;
  tags: string[];
}

export interface FederationPagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface FederationSearchResponse {
  results: FederationSearchResult[];
  pagination: FederationPagination;
}

export interface FederationIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface FederationRecipe {
  id: number;
  title: string;
  summary: string | null;
  content: string;
  ingredients: FederationIngredient[];
  tags: string[];
  servings: number | null;
  total_time_minutes: number | null;
  active_time_minutes: number | null;
  difficulty: string | null;
  image_url: string | null;
  source_url: string | null;
  enclosure_url: string | null;
  feed: { id: number; title: string; author: string | null };
}

// ── Pantry Host recipe shape (matches ParsedRecipe in import page) ────────────

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

// ── API client ────────────────────────────────────────────────────────────────

export async function searchFederationRecipes(
  query: string,
  page = 1,
  limit = 12,
): Promise<FederationSearchResponse> {
  const url = `${FEDERATION_BASE}/api/search?q=${encodeURIComponent(query)}&limit=${limit}&page=${page}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Federation search failed: ${res.status}`);
  return res.json();
}

export async function getFederationRecipe(id: number): Promise<FederationRecipe> {
  const url = `${FEDERATION_BASE}/api/recipes/${id}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Federation recipe fetch failed: ${res.status}`);
  return res.json();
}

// ── Converters ────────────────────────────────────────────────────────────────

/**
 * Convert a Cooklang federation recipe to a Pantry Host ParsedRecipe.
 */
export function cooklangToRecipe(api: FederationRecipe): ParsedRecipe {
  // Strip YAML frontmatter (--- ... ---) and clean up .cook syntax for display
  let instructions = api.content
    .replace(/^---[\s\S]*?---\n*/m, '')
    .trim();

  // Clean .cook syntax for readability:
  // @ingredient{qty%unit} → ingredient
  // #cookware{} → cookware
  // ~{time%unit} → time unit
  instructions = instructions
    .replace(/-?@([^{]+)\{[^}]*\}/g, '$1')
    .replace(/#([^{]+)\{[^}]*\}/g, '$1')
    .replace(/~\{([^%}]+)%([^}]+)\}/g, '$1 $2')
    .replace(/~\{([^}]+)\}/g, '$1');

  // Convert section headers (= Section) to numbered format
  let stepNum = 0;
  instructions = instructions
    .split('\n')
    .map((line) => {
      const sectionMatch = line.match(/^=\s+(.+)/);
      if (sectionMatch) return `\n${sectionMatch[1]}:`;
      if (line.trim() && !line.startsWith('>>') && !line.startsWith('--')) {
        stepNum++;
        return `${stepNum}. ${line.trim()}`;
      }
      return line;
    })
    .filter((line) => !line.startsWith('>>'))
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const activeTime = api.active_time_minutes ?? 0;
  const totalTime = api.total_time_minutes ?? 0;

  return {
    title: api.title,
    instructions,
    servings: api.servings ?? undefined,
    prepTime: activeTime || undefined,
    cookTime: totalTime > activeTime ? totalTime - activeTime : undefined,
    tags: [...api.tags, 'cooklang'],
    photoUrl: api.image_url ?? undefined,
    sourceUrl: api.source_url ?? undefined,
    ingredients: api.ingredients
      .filter((i) => i.name && !i.name.startsWith('-'))
      .map((i) => ({
        ingredientName: i.name,
        quantity: i.quantity,
        unit: i.unit,
      })),
  };
}

/**
 * Convert a Pantry Host recipe to .cook format.
 */
export function recipeToCooklang(recipe: {
  title: string;
  description?: string | null;
  instructions: string;
  servings?: number | null;
  prepTime?: number | null;
  cookTime?: number | null;
  tags?: string[];
  sourceUrl?: string | null;
  ingredients?: { ingredientName: string; quantity?: number | null; unit?: string | null }[];
}): string {
  const lines: string[] = [];

  // Metadata
  lines.push(`>> title: ${recipe.title}`);
  if (recipe.servings) lines.push(`>> servings: ${recipe.servings}`);
  if (recipe.prepTime) lines.push(`>> prep time: ${recipe.prepTime} minutes`);
  if (recipe.cookTime) lines.push(`>> cook time: ${recipe.cookTime} minutes`);
  if (recipe.tags?.length) lines.push(`>> tags: ${recipe.tags.join(', ')}`);
  lines.push(`>> source: Pantry Host`);
  if (recipe.sourceUrl) lines.push(`>> source url: ${recipe.sourceUrl}`);
  lines.push('');

  if (recipe.description) {
    lines.push(recipe.description);
    lines.push('');
  }

  // Inline ingredients into instructions where they appear in the text.
  // Track which ingredients were inlined so unmentioned ones can be listed separately.
  const ingredients = recipe.ingredients ?? [];
  const inlined = new Set<number>();

  // Build a map of ingredient name → .cook syntax, sorted longest-first to avoid
  // partial matches (e.g. "olive oil" before "oil")
  const ingIndex = ingredients
    .map((ing, i) => ({ ing, i }))
    .sort((a, b) => b.ing.ingredientName.length - a.ing.ingredientName.length);

  function formatCooklang(ing: { ingredientName: string; quantity?: number | null; unit?: string | null }): string {
    if (ing.quantity != null && ing.unit) return `@${ing.ingredientName}{${ing.quantity}%${ing.unit}}`;
    if (ing.quantity != null) return `@${ing.ingredientName}{${ing.quantity}}`;
    return `@${ing.ingredientName}{}`;
  }

  let instructionText = recipe.instructions;

  // Replace each ingredient's first occurrence in the instructions
  for (const { ing, i } of ingIndex) {
    const name = ing.ingredientName;
    // Case-insensitive search for the ingredient name in instructions
    const regex = new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (regex.test(instructionText)) {
      instructionText = instructionText.replace(regex, formatCooklang(ing));
      inlined.add(i);
    }
  }

  // List any ingredients not found in the instructions as standalone references
  const unmentioned = ingredients.filter((_, i) => !inlined.has(i));
  if (unmentioned.length > 0) {
    for (const ing of unmentioned) {
      lines.push(formatCooklang(ing));
    }
    lines.push('');
  }

  lines.push(instructionText);

  return lines.join('\n');
}

/**
 * Derive a raw GitHub base URL for step photos from a Cooklang source_url.
 * Returns null for non-GitHub sources.
 *
 * Input:  https://github.com/demosjarco/recipes/blob/main/recipes/Lunches/Buffalo Chicken Sandwich.cook
 * Output: https://raw.githubusercontent.com/demosjarco/recipes/main/recipes/Lunches/Buffalo Chicken Sandwich
 *
 * Step N photo = `${base}.${n}.jpg`
 */
export function stepPhotoBaseUrl(sourceUrl: string): string | null {
  const match = sourceUrl.match(
    /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)\.cook$/
  );
  if (!match) return null;
  const [, owner, repo, branch, path] = match;
  return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;
}

/**
 * Download a recipe as a .cook file.
 */
export function downloadCooklang(recipe: Parameters<typeof recipeToCooklang>[0], slug?: string): void {
  const content = recipeToCooklang(recipe);
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slug || recipe.title.toLowerCase().replace(/\s+/g, '-')}.cook`;
  a.click();
  URL.revokeObjectURL(url);
}
