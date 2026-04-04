/**
 * Cooklang syntax parser — extracts ingredients, cookware, and timers
 * from instruction text written in Cooklang format.
 *
 * Syntax:
 *   @ingredient{qty%unit}  — ingredient with quantity and unit
 *   @ingredient{qty}       — ingredient with quantity, no unit
 *   @ingredient{}          — ingredient with no quantity
 *   -@ingredient{}         — skip (not a shopping list item)
 *   #cookware{}            — cookware reference
 *   ~{time%unit}           — timer
 */

export interface ExtractedIngredient {
  name: string;
  quantity: number | null;
  unit: string | null;
}

export interface CooklangExtraction {
  ingredients: ExtractedIngredient[];
  cookware: string[];
  cleanedText: string;
}

/** Parse fraction strings like "1/4", "1 1/2", "3/2" */
function parseFraction(s: string): number | null {
  if (!s) return null;
  s = s.trim();
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/**
 * Extract ingredients, cookware, and cleaned text from Cooklang-style instructions.
 * Deduplicates ingredients by name (case-insensitive), summing quantities when units match.
 */
export function extractCooklang(text: string): CooklangExtraction {
  const ingredientMap = new Map<string, ExtractedIngredient>();
  const cookwareSet = new Set<string>();

  // Extract ingredients: @name{qty%unit} or @name{qty} or @name{}
  // Skip -@name{} (Cooklang convention for "not a shopping list item")
  const ingredientRegex = /(?<!-)@([^{]+)\{([^}]*)\}/g;
  let match: RegExpExecArray | null;

  while ((match = ingredientRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const content = match[2].trim();

    let quantity: number | null = null;
    let unit: string | null = null;

    if (content.includes('%')) {
      const [qtyStr, unitStr] = content.split('%');
      quantity = parseFraction(qtyStr);
      unit = unitStr.trim() || null;
    } else if (content) {
      quantity = parseFraction(content);
    }

    const key = name.toLowerCase();
    const existing = ingredientMap.get(key);

    if (existing) {
      // Deduplicate: sum quantities if units match
      if (existing.quantity != null && quantity != null && existing.unit === unit) {
        existing.quantity += quantity;
      }
      // If units differ or one is null, keep the first occurrence
    } else {
      ingredientMap.set(key, { name, quantity, unit });
    }
  }

  // Extract cookware: #name{} or #name{size}
  const cookwareRegex = /#([^{]+)\{[^}]*\}/g;
  while ((match = cookwareRegex.exec(text)) !== null) {
    cookwareSet.add(match[1].trim());
  }

  // Clean text: strip Cooklang syntax to plain names
  let cleanedText = text
    // Strip -@name{content} (skip ingredients) → name
    .replace(/-@([^{]+)\{[^}]*\}/g, '$1')
    // Strip @name{content} → name
    .replace(/@([^{]+)\{[^}]*\}/g, '$1')
    // Strip #name{content} → name
    .replace(/#([^{]+)\{[^}]*\}/g, '$1')
    // Strip ~{time%unit} → time unit
    .replace(/~\{([^%}]+)%([^}]+)\}/g, '$1 $2')
    // Strip ~{time} → time
    .replace(/~\{([^}]+)\}/g, '$1')
    // Strip Cooklang comments [- ... -]
    .replace(/\[-[^]*?-\]/g, '')
    // Strip Cooklang metadata >> key: value
    .replace(/^>>\s*.*$/gm, '')
    // Clean up extra whitespace
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return {
    ingredients: Array.from(ingredientMap.values()),
    cookware: Array.from(cookwareSet),
    cleanedText,
  };
}

/**
 * Detect if text contains Cooklang syntax.
 * Returns true if any @ingredient{}, #cookware{}, or ~{timer} patterns are found.
 */
export function hasCooklangSyntax(text: string): boolean {
  return /@[^{]+\{/.test(text) || /#[^{]+\{/.test(text);
}
