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
  lines.push('');

  // Ingredients as .cook inline references in a comment block
  if (recipe.ingredients?.length) {
    lines.push('-- Ingredients --');
    for (const ing of recipe.ingredients) {
      if (ing.quantity != null && ing.unit) {
        lines.push(`-- @${ing.ingredientName}{${ing.quantity}%${ing.unit}}`);
      } else if (ing.quantity != null) {
        lines.push(`-- @${ing.ingredientName}{${ing.quantity}}`);
      } else {
        lines.push(`-- @${ing.ingredientName}{}`);
      }
    }
    lines.push('');
  }

  // Instructions as plain text
  if (recipe.description) {
    lines.push(recipe.description);
    lines.push('');
  }

  lines.push(recipe.instructions);

  return lines.join('\n');
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
