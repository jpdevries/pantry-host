/**
 * Shared import utilities used by both packages/app and packages/web
 * for the bulk URL import flow.
 */

export interface ParsedImportRecipe {
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
 * Extract URLs from pasted text, HTML bookmarks, or CSV files.
 * Supports http://, https://, and at:// URIs.
 */
export function extractUrls(text: string, filename?: string): string[] {
  const URL_RE = /^(https?:\/\/|at:\/\/)/i;

  const isHtml = filename?.endsWith('.html') || /<A HREF=/i.test(text);
  const isCsv = filename?.endsWith('.csv');

  if (isHtml) {
    return Array.from(text.matchAll(/<A HREF="([^"]+)"/gi))
      .map((m) => m[1])
      .filter((u) => URL_RE.test(u));
  }

  if (isCsv) {
    const lines = text.split(/\r?\n/);
    const header = lines[0]?.toLowerCase().split(',') ?? [];
    const urlCol = header.findIndex((h) => /^url|link|href|address$/i.test(h.trim()));
    const col = urlCol >= 0 ? urlCol : 0;
    return lines
      .slice(urlCol >= 0 ? 1 : 0)
      .map((l) => l.split(',')[col]?.replace(/^"|"$/g, '').trim() ?? '')
      .filter((u) => URL_RE.test(u));
  }

  return text.split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => URL_RE.test(l));
}

/**
 * Detect if pasted content is a Pantry Host HTML export and parse it directly.
 * Returns null if the content isn't a Pantry Host export.
 */
export function tryParsePantryHostExport(text: string): ParsedImportRecipe[] | null {
  if (!/<meta\s+name="generator"\s+content="Pantry Host"/i.test(text)) return null;
  const ldMatch = text.match(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/i);
  if (!ldMatch) return null;
  try {
    const data = JSON.parse(ldMatch[1]);
    if (Array.isArray(data)) {
      const recipes = data.map(parseLdRecipe).filter(Boolean) as ParsedImportRecipe[];
      return recipes.length > 0 ? recipes : null;
    }
    const recipe = parseLdRecipe(data);
    return recipe ? [recipe] : null;
  } catch {
    return null;
  }
}

function parseLdRecipe(data: Record<string, unknown>): ParsedImportRecipe | null {
  if (data['@type'] !== 'Recipe') return null;
  const parseDur = (iso?: string) => {
    if (!iso) return undefined;
    const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    return m ? (parseInt(m[1] || '0') * 60 + parseInt(m[2] || '0')) || undefined : undefined;
  };
  const structured = data['pantryHost:ingredients'] as { name: string; quantity: number | null; unit: string | null }[] | undefined;
  const ingredients = Array.isArray(structured)
    ? structured.map((ing) => ({ ingredientName: ing.name, quantity: ing.quantity, unit: ing.unit }))
    : ((data.recipeIngredient ?? []) as string[]).map((line) => ({ ingredientName: line, quantity: null, unit: null }));
  return {
    title: data.name as string,
    description: data.description as string | undefined,
    instructions: Array.isArray(data.recipeInstructions)
      ? (data.recipeInstructions as (string | { text: string })[])
          .map((s, i) => `${i + 1}. ${typeof s === 'string' ? s : s.text}`)
          .join('\n')
      : (data.recipeInstructions as string) ?? '',
    servings: typeof data.recipeYield === 'string'
      ? parseInt(data.recipeYield) || undefined
      : data.recipeYield as number | undefined,
    prepTime: parseDur(data.prepTime as string | undefined),
    cookTime: parseDur(data.cookTime as string | undefined),
    tags: [...((data.keywords ?? []) as string[])],
    photoUrl: typeof data.image === 'string' ? data.image : undefined,
    ingredients,
  };
}
