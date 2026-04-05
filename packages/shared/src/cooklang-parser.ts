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
 * Parse Cooklang `>> key: value` metadata lines into structured fields.
 * Supports: title, servings, prep time, cook time, time (mapped to cook time), tags, source.
 */
export interface CooklangMetadata {
  title?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
  source?: string;
}

export function parseCooklangMetadata(text: string): CooklangMetadata {
  const meta: CooklangMetadata = {};
  const lines = text.split('\n');
  for (const line of lines) {
    const m = line.match(/^>>\s*([^:]+):\s*(.+)$/);
    if (!m) continue;
    const key = m[1].trim().toLowerCase();
    const val = m[2].trim();
    switch (key) {
      case 'title': meta.title = val; break;
      case 'servings': { const n = parseInt(val); if (!isNaN(n)) meta.servings = n; break; }
      case 'prep time':
      case 'prep_time':
      case 'preptime': { const n = parseInt(val); if (!isNaN(n)) meta.prepTime = n; break; }
      case 'cook time':
      case 'cook_time':
      case 'cooktime': { const n = parseInt(val); if (!isNaN(n)) meta.cookTime = n; break; }
      case 'time':
      case 'total time': { const n = parseInt(val); if (!isNaN(n)) meta.cookTime = n; break; }
      case 'tags': meta.tags = val.split(',').map((t) => t.trim()).filter(Boolean); break;
      case 'source': meta.source = val; break;
    }
  }
  return meta;
}

/**
 * Detect if text contains Cooklang syntax.
 * Returns true if any @ingredient{}, #cookware{}, or ~{timer} patterns are found.
 */
export function hasCooklangSyntax(text: string): boolean {
  return /@[^{]+\{/.test(text) || /#[^{]+\{/.test(text);
}

/**
 * Update a Cooklang ingredient reference in instructions text.
 *
 * When only one `@name{...}` exists, replaces it directly.
 *
 * When multiple references exist (e.g. garlic used in two steps),
 * leaves all but the first unchanged and sets the first occurrence to
 * `newTotal − sumOfOthers` so the total across all references equals
 * the quantity from the ingredient editor.
 *
 * Returns the updated text, or the original if no match found.
 */
export function updateCooklangIngredient(
  text: string,
  name: string,
  quantity: string | null,
  unit: string | null,
): string {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const globalRegex = new RegExp(`@${escaped}\\{([^}]*)\\}`, 'gi');

  // Collect all matches
  const matches: { index: number; fullMatch: string; content: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = globalRegex.exec(text)) !== null) {
    matches.push({ index: m.index, fullMatch: m[0], content: m[1] });
  }

  if (matches.length === 0) return text;

  /** Parse qty from a match's content string (e.g. "3%cloves" → 3) */
  function parseQty(content: string): number | null {
    const s = content.includes('%') ? content.split('%')[0].trim() : content.trim();
    if (!s) return null;
    const n = parseFloat(s);
    return isNaN(n) ? null : n;
  }

  const newTotal = quantity ? parseFloat(quantity) : null;

  // Build content string helper
  function buildContent(qty: number | string | null): string {
    const q = qty != null ? String(qty) : null;
    if (q && unit && unit !== 'whole') return `${q}%${unit}`;
    if (q) return q;
    return '';
  }

  if (matches.length === 1) {
    // Single reference — replace directly
    return text.replace(matches[0].fullMatch, `@${name}{${buildContent(newTotal)}}`);
  }

  // Multiple references — set first to newTotal − sumOfOthers
  if (newTotal == null) {
    // No quantity: just clear the first reference's quantity
    return text.replace(matches[0].fullMatch, `@${name}{${buildContent(null)}}`);
  }

  // Sum quantities of all references except the first
  let sumOfOthers = 0;
  for (let i = 1; i < matches.length; i++) {
    const q = parseQty(matches[i].content);
    if (q != null) sumOfOthers += q;
  }

  const firstQty = Math.max(0, Math.round((newTotal - sumOfOthers) * 100) / 100);
  return text.replace(matches[0].fullMatch, `@${name}{${buildContent(firstQty)}}`);
}
