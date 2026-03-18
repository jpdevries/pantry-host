import http from 'http';
import { execute, parse, validate } from 'graphql';
import { schema } from './lib/schema/index.js';
import sql from './lib/db.js';

const PORT = parseInt(process.env.GRAPHQL_PORT ?? '4001', 10);

// ── Recipe URL fetch helpers ──────────────────────────────────────────────────

function parseDuration(iso: string): number | undefined {
  const match = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  if (!match) return undefined;
  return parseInt(match[1] ?? '0', 10) * 60 + parseInt(match[2] ?? '0', 10);
}

function parseServings(val: unknown): number | undefined {
  if (typeof val === 'number') return Math.round(val);
  if (typeof val === 'string') { const n = parseInt(val, 10); return isNaN(n) ? undefined : n; }
  return undefined;
}

function flattenInstructionSteps(val: unknown): string[] {
  if (typeof val === 'string') return [val];
  if (Array.isArray(val)) {
    const out: string[] = [];
    for (const step of val) {
      if (typeof step === 'string') { out.push(step); continue; }
      if (step && typeof step === 'object') {
        const s = step as Record<string, unknown>;
        // HowToSection: recurse into itemListElement
        if (s['@type'] === 'HowToSection' && Array.isArray(s.itemListElement)) {
          out.push(...flattenInstructionSteps(s.itemListElement));
        } else if (typeof s.text === 'string') {
          out.push(s.text);
        }
      }
    }
    return out;
  }
  return [];
}

function parseInstructions(val: unknown): string {
  if (typeof val === 'string') return val;
  const steps = flattenInstructionSteps(val);
  return steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
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

// Maps verbose unit spellings to the canonical values used in the app
const UNIT_MAP: Record<string, string> = {
  tablespoon: 'tbsp', tablespoons: 'tbsp', tbsp: 'tbsp', tbs: 'tbsp',
  teaspoon: 'tsp', teaspoons: 'tsp', tsp: 'tsp',
  cup: 'cup', cups: 'cup',
  'fl oz': 'fl oz', 'fluid ounce': 'fl oz', 'fluid ounces': 'fl oz',
  pint: 'pt', pints: 'pt', pt: 'pt',
  quart: 'qt', quarts: 'qt', qt: 'qt',
  gallon: 'gal', gallons: 'gal', gal: 'gal',
  milliliter: 'ml', milliliters: 'ml', ml: 'ml',
  liter: 'l', liters: 'l',
  ounce: 'oz', ounces: 'oz', oz: 'oz',
  pound: 'lb', pounds: 'lb', lbs: 'lb', lb: 'lb',
  gram: 'g', grams: 'g',
  kilogram: 'kg', kilograms: 'kg', kg: 'kg',
  slice: 'slice', slices: 'slice',
  clove: 'clove', cloves: 'clove',
  stalk: 'stalk', stalks: 'stalk', sprig: 'stalk', sprigs: 'stalk',
  bunch: 'bunch', bunches: 'bunch',
  can: 'can', cans: 'can',
  jar: 'jar', jars: 'jar',
  head: 'head', heads: 'head',
  dozen: 'dozen',
  pinch: 'pinch', pinches: 'pinch',
  dash: 'dash', dashes: 'dash',
};

// Sorted longest-first so "tablespoon" matches before "tbs"
const UNIT_KEYS = Object.keys(UNIT_MAP).sort((a, b) => b.length - a.length);

const UNICODE_FRACTIONS: Record<string, number> = {
  '½': 0.5, '¼': 0.25, '¾': 0.75,
  '⅓': 1 / 3, '⅔': 2 / 3,
  '⅕': 0.2, '⅖': 0.4, '⅗': 0.6, '⅘': 0.8,
  '⅙': 1 / 6, '⅚': 5 / 6,
  '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875,
};
const UNICODE_FRAC_RE = new RegExp(`^(\\d+)?\\s*([${Object.keys(UNICODE_FRACTIONS).join('')}])\\s+`);

function parseIngredientLine(line: string): { ingredientName: string; quantity: number | null; unit: string | null } {
  let s = line.trim();
  let quantity: number | null = null;

  // 1a. Unicode fraction characters, optionally preceded by a whole number (e.g. "1½", "½")
  const unicodeMatch = s.match(UNICODE_FRAC_RE);
  if (unicodeMatch) {
    const whole = unicodeMatch[1] ? parseInt(unicodeMatch[1], 10) : 0;
    quantity = whole + UNICODE_FRACTIONS[unicodeMatch[2]];
    s = s.slice(unicodeMatch[0].length);
  } else {
    // 1b. ASCII quantity: mixed number (1 1/2), fraction (1/2), or decimal/integer
    const qtyRe = /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)\s+/;
    const qtyMatch = s.match(qtyRe);
    if (qtyMatch) {
      const raw = qtyMatch[1].trim();
      if (raw.includes('/')) {
        if (/\s/.test(raw)) {
          const [whole, frac] = raw.split(/\s+/);
          const [n, d] = frac.split('/');
          quantity = parseInt(whole, 10) + parseInt(n, 10) / parseInt(d, 10);
        } else {
          const [n, d] = raw.split('/');
          quantity = parseInt(n, 10) / parseInt(d, 10);
        }
      } else {
        quantity = parseFloat(raw);
      }
      s = s.slice(qtyMatch[0].length);
    }
  }

  // 2. Unit: only attempt if we found a quantity
  if (quantity !== null) {
    for (const key of UNIT_KEYS) {
      const re = new RegExp(`^${key.replace(' ', '\\s+')}(?=\\s|$)`, 'i');
      if (re.test(s)) {
        s = s.slice(key.length).trimStart();
        return { ingredientName: s, quantity, unit: UNIT_MAP[key] };
      }
    }
  }

  // No unit matched — return stripped string if we found a quantity, otherwise the original line
  return { ingredientName: quantity !== null ? s.trim() : line.trim(), quantity, unit: null };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFromLdJson(data: any) {
  if (data['@graph']) {
    const recipe = data['@graph'].find((n: { '@type': string }) => n['@type'] === 'Recipe');
    if (recipe) return extractFromLdJson(recipe);
  }
  return {
    title: data.name,
    description: typeof data.description === 'string' ? data.description : undefined,
    instructions: parseInstructions(data.recipeInstructions),
    servings: parseServings(data.recipeYield),
    prepTime: data.prepTime ? parseDuration(data.prepTime) : undefined,
    cookTime: data.cookTime ? parseDuration(data.cookTime) : undefined,
    tags: [
      ...(Array.isArray(data.keywords) ? data.keywords : typeof data.keywords === 'string' ? data.keywords.split(',').map((k: string) => k.trim()) : []),
      ...(data.recipeCategory ? [data.recipeCategory].flat() : []),
    ].filter((t: string) => {
      if (!t) return false;
      // Drop SEO-stuffed tags that just restate the recipe title
      const title = (data.name || '').toLowerCase();
      const tag = t.toLowerCase();
      if (!title || !tag) return true;
      // Remove if tag contains the full title or title contains the full tag
      if (tag.includes(title) || title.includes(tag)) return false;
      // Remove "how to make X", "X recipe", "X ingredients" patterns
      if (/^how to (make|cook|prepare)\b/i.test(t)) return false;
      if (/\b(recipe|ingredients)\s*$/i.test(t) && title.split(' ').some((w: string) => tag.includes(w.toLowerCase()))) return false;
      return true;
    }),
    photoUrl: parsePhotoUrl(data.image),
    ingredients: Array.isArray(data.recipeIngredient)
      ? data.recipeIngredient.map((line: string) => parseIngredientLine(line))
      : [],
  };
}

function decodeHtmlEntities(s: string): string {
  return s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
}

function extractFromMicrodata(html: string): { title: string; ingredients: ReturnType<typeof parseIngredientLine>[]; instructions: string; prepTime?: number; cookTime?: number; servings?: number } | null {
  // Find a container with Schema.org Recipe itemtype
  const containerRe = /<[^>]+itemtype="[^"]*schema\.org\/Recipe[^"]*"[^>]*>([\s\S]*)/i;
  const containerMatch = html.match(containerRe);
  if (!containerMatch) return null;
  const block = containerMatch[1];

  // Recipe name
  const nameMatch = block.match(/itemprop="name"[^>]*>([^<]+)/i) ?? block.match(/itemprop="name"[\s\S]*?<(?:span|h[1-6]|p)[^>]*>([^<]+)/i);
  if (!nameMatch) return null;
  const title = decodeHtmlEntities(nameMatch[1].trim());

  // Ingredients: find all itemprop="recipeIngredient" regions and extract innermost text
  const ings: string[] = [];
  for (const m of block.matchAll(/itemprop="recipeIngredient"[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>\s*<\/span>/gi)) {
    const text = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '')).trim();
    if (text) ings.push(text);
  }
  // Simpler fallback: direct text content after itemprop
  if (ings.length === 0) {
    for (const m of block.matchAll(/itemprop="recipeIngredient"[^>]*>([^<]+)</gi)) {
      const text = decodeHtmlEntities(m[1]).trim();
      if (text) ings.push(text);
    }
  }

  // Instructions
  const steps: string[] = [];
  for (const m of block.matchAll(/itemprop="recipeInstructions?"[^>]*>[\s\S]*?<span[^>]*>([\s\S]*?)<\/span>/gi)) {
    const text = decodeHtmlEntities(m[1].replace(/<[^>]+>/g, '')).trim();
    if (text) steps.push(text);
  }
  if (steps.length === 0) {
    for (const m of block.matchAll(/itemprop="recipeInstructions?"[^>]*>([^<]+)</gi)) {
      const text = decodeHtmlEntities(m[1]).trim();
      if (text) steps.push(text);
    }
  }

  // Times and servings
  const prepMatch = block.match(/itemprop="prepTime"[^>]*content="([^"]+)"/i);
  const cookMatch = block.match(/itemprop="cookTime"[^>]*content="([^"]+)"/i);
  const servingsMatch = block.match(/itemprop="recipeYield"[^>]*(?:content="([^"]+)"|>([^<]+))/i);

  return {
    title,
    ingredients: ings.map(parseIngredientLine),
    instructions: steps.map((s, i) => `${i + 1}. ${s}`).join('\n'),
    ...(prepMatch ? { prepTime: parseDuration(prepMatch[1]) } : {}),
    ...(cookMatch ? { cookTime: parseDuration(cookMatch[1]) } : {}),
    ...(servingsMatch ? { servings: parseServings(servingsMatch[1] ?? servingsMatch[2]) } : {}),
  };
}

function extractFromHtml(html: string): { title: string; ingredients: ReturnType<typeof parseIngredientLine>[]; instructions: string } | null {
  // Title from h1 or <title>
  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = decodeHtmlEntities((h1Match?.[1] ?? titleTagMatch?.[1] ?? '').trim());
  if (!title) return null;

  const ingredients: string[] = [];

  // Strategy 1: <div class="ingredients"> or <ul class="ingredients"> or similar container
  const ingContainerRe = /<(?:div|section|ul)[^>]*class="[^"]*ingredient[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|ul)>/gi;
  for (const m of html.matchAll(ingContainerRe)) {
    const block = m[1];
    // Extract from <li> items
    for (const li of block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = decodeHtmlEntities(li[1].replace(/<[^>]+>/g, '')).trim();
      if (text && text.length < 200) ingredients.push(text);
    }
    // Extract from <br> separated lines (like Almond Cow)
    if (ingredients.length === 0) {
      const lines = block.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '').split('\n');
      for (const line of lines) {
        const text = decodeHtmlEntities(line).trim();
        if (text && text.length < 200 && /\d|cup|tsp|tbsp|oz|lb|pinch|dash/i.test(text)) {
          ingredients.push(text);
        }
      }
    }
  }

  // Strategy 2: heading containing "Ingredients" followed by a <ul>
  if (ingredients.length === 0) {
    const headingRe = /<h[2-4][^>]*>[^<]*ingredients[^<]*<\/h[2-4]>\s*([\s\S]*?)(?=<h[2-4]|<\/section|<\/article)/gi;
    for (const m of html.matchAll(headingRe)) {
      const block = m[1];
      for (const li of block.matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        const text = decodeHtmlEntities(li[1].replace(/<[^>]+>/g, '')).trim();
        if (text && text.length < 200) ingredients.push(text);
      }
      if (ingredients.length > 0) break;
    }
  }

  // Extract instructions similarly
  let instructions = '';
  const instrContainerRe = /<(?:div|section|ol)[^>]*class="[^"]*(?:instruction|direction|step|method)[^"]*"[^>]*>([\s\S]*?)<\/(?:div|section|ol)>/gi;
  for (const m of html.matchAll(instrContainerRe)) {
    const steps: string[] = [];
    for (const li of m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
      const text = decodeHtmlEntities(li[1].replace(/<[^>]+>/g, '')).trim();
      if (text) steps.push(text);
    }
    if (steps.length > 0) {
      instructions = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
      break;
    }
  }

  // Fallback: heading containing "Instructions"/"Directions" followed by content
  if (!instructions) {
    const instrHeadingRe = /<h[2-4][^>]*>[^<]*(?:instruction|direction|method|step)[^<]*<\/h[2-4]>\s*([\s\S]*?)(?=<h[2-4]|<\/section|<\/article|<div\s)/gi;
    for (const m of html.matchAll(instrHeadingRe)) {
      const steps: string[] = [];
      for (const li of m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)) {
        const text = decodeHtmlEntities(li[1].replace(/<[^>]+>/g, '')).trim();
        if (text) steps.push(text);
      }
      if (steps.length > 0) {
        instructions = steps.map((s, i) => `${i + 1}. ${s}`).join('\n');
        break;
      }
      // Plain text with numbered steps or <br> separated
      const plainText = m[1].replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '');
      const lines = plainText.split('\n').map(l => l.trim()).filter(l => l.length > 0 && l.length < 300 && !/^share|^tweet|^pin|^print|^email|^facebook|^twitter/i.test(l) && !l.startsWith('http'));
      if (lines.length > 0) {
        instructions = lines.map((s, i) => s.match(/^\d+\./) ? s : `${i + 1}. ${s}`).join('\n');
        break;
      }
    }
  }

  if (ingredients.length === 0) return null;

  return { title, ingredients: ingredients.map(parseIngredientLine), instructions };
}

async function detectCookware(recipe: Record<string, unknown>): Promise<string[]> {
  const cookwareRows = await sql`SELECT name FROM cookware`;
  if (!cookwareRows.length) return [];
  // Build searchable text from all recipe fields
  const text = [recipe.title, recipe.description, recipe.instructions,
    ...(Array.isArray(recipe.ingredients) ? recipe.ingredients.map((i: { ingredientName?: string }) => i.ingredientName ?? '') : []),
  ].filter(Boolean).join(' ').toLowerCase();
  return cookwareRows
    .filter((row) => {
      const name = row.name.toLowerCase();
      // Strip trailing size/capacity info (e.g. "6qt", "12cup", "36\"") for fuzzy match
      const baseName = name.replace(/\s+\d+[\w"]*$/i, '').trim();
      return text.includes(name) || text.includes(baseName);
    })
    .map((row) => row.name as string);
}

async function handleFetchRecipe(body: string, res: http.ServerResponse) {
  const { url } = JSON.parse(body) as { url?: string };
  if (!url) { res.writeHead(400, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'url is required' })); return; }

  let html: string;
  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 10_000);
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PantryListBot/1.0)' },
      signal: ac.signal,
    });
    clearTimeout(timer);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    html = await response.text();
  } catch (err) {
    res.writeHead(502, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `Failed to fetch URL: ${(err as Error).message}` }));
    return;
  }

  // Helper: detect cookware, attach to result, and send response
  async function sendResult(result: Record<string, unknown>) {
    const requiredCookware = await detectCookware(result);
    if (requiredCookware.length > 0) result.requiredCookware = requiredCookware;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
  }

  const ldMatches = html.matchAll(/<script[^>]+type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of ldMatches) {
    try {
      const data = JSON.parse(match[1]);
      const type = data['@type'];
      if (type === 'Recipe' || (Array.isArray(type) && type.includes('Recipe')) || data['@graph']) {
        const parsed = extractFromLdJson(data);
        if (parsed.title) { await sendResult(parsed); return; }
      }
    } catch { /* continue */ }
  }

  // Fallback: Schema.org microdata (itemprop attributes)
  const microdataResult = extractFromMicrodata(html);
  if (microdataResult?.title) {
    await sendResult(microdataResult);
    return;
  }

  // Fallback: heuristic extraction from common HTML patterns
  const heuristicResult = extractFromHtml(html);
  if (heuristicResult?.title && heuristicResult.ingredients.length > 0) {
    await sendResult(heuristicResult);
    return;
  }

  const h1Match = html.match(/<h1[^>]*>([^<]+)<\/h1>/i);
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = (h1Match?.[1] ?? titleTagMatch?.[1] ?? '').trim().replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/&#39;/g, "'");
  if (!title) { res.writeHead(422, { 'Content-Type': 'application/json' }); res.end(JSON.stringify({ error: 'Could not extract recipe data from this page.' })); return; }
  await sendResult({ title, ingredients: [] });
}

// ── HTTP server ───────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
  if (req.method !== 'POST') { res.writeHead(405); res.end('Method not allowed'); return; }

  let body = '';
  req.on('data', (chunk: string) => { body += chunk; });
  req.on('end', async () => {
    try {
      if (req.url === '/fetch-recipe') {
        await handleFetchRecipe(body, res);
        return;
      }

      // Default: GraphQL
      const { query, variables } = JSON.parse(body) as { query: string; variables?: Record<string, unknown> };
      const document = parse(query);
      const validationErrors = validate(schema, document);
      if (validationErrors.length) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ errors: validationErrors.map((e) => ({ message: e.message })) }));
        return;
      }
      const result = await execute({ schema, document, variableValues: variables ?? {} });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (err) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ errors: [{ message: (err as Error).message }] }));
    }
  });
});

async function runMigrations() {
  // Add kitchens table
  await sql`
    CREATE TABLE IF NOT EXISTS kitchens (
      id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
      slug       TEXT NOT NULL UNIQUE,
      name       TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `;
  // Seed home kitchen
  await sql`INSERT INTO kitchens (slug, name) VALUES ('home', 'Home') ON CONFLICT (slug) DO NOTHING`;
  // Add kitchen_id columns to data tables
  await sql`ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS kitchen_id TEXT REFERENCES kitchens(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE recipes     ADD COLUMN IF NOT EXISTS kitchen_id TEXT REFERENCES kitchens(id) ON DELETE CASCADE`;
  await sql`ALTER TABLE cookware    ADD COLUMN IF NOT EXISTS kitchen_id TEXT REFERENCES kitchens(id) ON DELETE CASCADE`;
  // Backfill existing rows to home kitchen
  await sql`UPDATE ingredients SET kitchen_id = (SELECT id FROM kitchens WHERE slug = 'home') WHERE kitchen_id IS NULL`;
  await sql`UPDATE recipes     SET kitchen_id = (SELECT id FROM kitchens WHERE slug = 'home') WHERE kitchen_id IS NULL`;
  await sql`UPDATE cookware    SET kitchen_id = (SELECT id FROM kitchens WHERE slug = 'home') WHERE kitchen_id IS NULL`;
  // Add slug column to recipes
  await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS slug TEXT`;
  await sql`CREATE UNIQUE INDEX IF NOT EXISTS recipes_slug_idx ON recipes (slug) WHERE slug IS NOT NULL`;
  // Backfill slugs for existing recipes that don't have one
  const unslugged = await sql`SELECT id, title FROM recipes WHERE slug IS NULL`;
  for (const row of unslugged) {
    const base = row.title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
    let candidate = base;
    let suffix = 2;
    while (true) {
      const [existing] = await sql`SELECT id FROM recipes WHERE slug = ${candidate}`;
      if (!existing) break;
      candidate = `${base}-${suffix++}`;
    }
    await sql`UPDATE recipes SET slug = ${candidate} WHERE id = ${row.id}`;
  }
  // Add source_url column to recipes
  await sql`ALTER TABLE recipes ADD COLUMN IF NOT EXISTS source_url TEXT`;
}

runMigrations()
  .then(() => {
    server.listen(PORT, '0.0.0.0', () => {
      console.log(`GraphQL API ready at http://0.0.0.0:${PORT}/graphql`);
      console.log(`Recipe fetch proxy ready at http://0.0.0.0:${PORT}/fetch-recipe`);
    });
  })
  .catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
