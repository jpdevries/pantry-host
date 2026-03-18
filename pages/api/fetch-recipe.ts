import type { NextApiRequest, NextApiResponse } from 'next';

interface ParsedRecipe {
  title?: string;
  description?: string;
  instructions?: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
  photoUrl?: string;
  ingredients?: { ingredientName: string; quantity: number | null; unit: string | null }[];
}

/** Decode common HTML entities that sneak into LD+JSON or scraped text. */
function decodeEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function parseDuration(iso: string): number | undefined {
  // Parse ISO 8601 duration like PT30M, PT1H30M
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return undefined;
  const hours = parseInt(match[1] ?? '0', 10);
  const minutes = parseInt(match[2] ?? '0', 10);
  return hours * 60 + minutes;
}

function parseServings(val: unknown): number | undefined {
  if (typeof val === 'number') return Math.round(val);
  if (typeof val === 'string') {
    const n = parseInt(val, 10);
    return isNaN(n) ? undefined : n;
  }
  return undefined;
}

function parseInstructions(val: unknown): string {
  if (typeof val === 'string') return val;
  if (Array.isArray(val)) {
    return val
      .map((step: unknown, i: number) => {
        if (typeof step === 'string') return `${i + 1}. ${step}`;
        if (step && typeof step === 'object' && 'text' in step) {
          return `${i + 1}. ${(step as { text: string }).text}`;
        }
        return `${i + 1}. ${JSON.stringify(step)}`;
      })
      .join('\n');
  }
  return '';
}

function parsePhotoUrl(val: unknown): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) {
    const first = val[0];
    if (typeof first === 'string') return first;
    if (first && typeof first === 'object' && 'url' in first) return (first as { url: string }).url;
  }
  if (val && typeof val === 'object' && 'url' in val) return (val as { url: string }).url;
  return undefined;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromLdJson(data: any): ParsedRecipe {
  // Handle @graph arrays (e.g. Yoast SEO schema)
  if (data['@graph']) {
    const recipe = data['@graph'].find((n: { '@type': string }) => n['@type'] === 'Recipe');
    if (recipe) return extractFromLdJson(recipe);
  }

  return {
    title: typeof data.name === 'string' ? decodeEntities(data.name) : data.name,
    description: typeof data.description === 'string' ? decodeEntities(data.description) : undefined,
    instructions: parseInstructions(data.recipeInstructions),
    servings: parseServings(data.recipeYield),
    prepTime: data.prepTime ? parseDuration(data.prepTime) : undefined,
    cookTime: data.cookTime ? parseDuration(data.cookTime) : undefined,
    tags: [
      ...(Array.isArray(data.keywords)
        ? data.keywords.map((k: string) => typeof k === 'string' ? decodeEntities(k) : k)
        : typeof data.keywords === 'string'
          ? decodeEntities(data.keywords).split(',').map((k: string) => k.trim())
          : []),
      ...(data.recipeCategory ? [data.recipeCategory].flat().map((c: string) => typeof c === 'string' ? decodeEntities(c) : c) : []),
    ].filter(Boolean),
    photoUrl: parsePhotoUrl(data.image),
    ingredients: Array.isArray(data.recipeIngredient)
      ? data.recipeIngredient.map((line: string) => ({
          ingredientName: typeof line === 'string' ? decodeEntities(line) : line,
          quantity: null,
          unit: null,
        }))
      : [],
  };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body as { url?: string };
  if (!url) return res.status(400).json({ error: 'url is required' });

  let html: string;
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PantryListBot/1.0)' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (err) {
    return res.status(502).json({ error: `Failed to fetch URL: ${(err as Error).message}` });
  }

  // Try extracting LD+JSON schema.org Recipe
  const ldMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of ldMatches) {
    try {
      const data = JSON.parse(match[1]);
      const type = data['@type'];
      if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe')) || data['@graph']) {
        const parsed = extractFromLdJson(data);
        if (parsed.title) return res.json(parsed);
      }
    } catch {
      // continue
    }
  }

  // Fallback: simple regex title extraction (LD+JSON is the preferred path)
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = decodeEntities((h1Match?.[1] ?? titleTagMatch?.[1] ?? '').trim());

  if (!title) {
    return res.status(422).json({ error: 'Could not extract recipe data from this page. Try copying the recipe manually.' });
  }

  return res.json({ title, ingredients: [] } as ParsedRecipe);
}
