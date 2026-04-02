import type { NextApiRequest, NextApiResponse } from 'next';
import sql from '@/lib/db';
import { generateRecipeICS, type ExportableRecipe } from '@pantry-host/shared/export-recipe';

/**
 * Resolve a recipe's photo URL to an absolute HTTP URL for ICS ATTACH.
 * Priority: external URL as-is > local upload via request origin > null.
 */
function resolvePhotoUrl(photoUrl: string | null, slug: string | null, req: NextApiRequest): string | null {
  if (!photoUrl) return null;

  // Already absolute
  if (photoUrl.startsWith('http')) return photoUrl;

  // Local upload — use the friendly recipe-photo endpoint (same origin, readable filename)
  if (photoUrl.startsWith('/uploads/') && slug) {
    const proto = req.headers['x-forwarded-proto'] || (req.headers.host?.includes('localhost') ? 'http' : 'https');
    const host = req.headers.host;
    if (host) return `${proto}://${host}/api/recipe-photo/${slug}.jpg`;
  }

  return null;
}

/**
 * Fetch og:image from an external recipe page as a last resort.
 * Regex-based — no HTML parsing dependencies.
 */
async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    const html = await res.text();
    const match = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
      || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
    return match?.[1] || null;
  } catch {
    return null;
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = req.query.slug as string;
  if (!slug) return res.status(400).send('Missing slug parameter');

  try {
    const [row] = await sql`SELECT * FROM recipes WHERE slug = ${slug}`;
    if (!row) return res.status(404).send('Recipe not found');

    const ingredients = await sql`
      SELECT ingredient_name, quantity, unit
      FROM recipe_ingredients
      WHERE recipe_id = ${row.id}
      ORDER BY sort_order
    `;

    const cookware = await sql`
      SELECT c.name FROM cookware c
      JOIN recipe_cookware rc ON rc.cookware_id = c.id
      WHERE rc.recipe_id = ${row.id}
    `;

    // Resolve photo URL: absolute > local via host > og:image from source
    let photoUrl = resolvePhotoUrl(row.photo_url, row.slug, req);
    if (!photoUrl && row.source_url) {
      photoUrl = await fetchOgImage(row.source_url);
    }

    const recipe: ExportableRecipe = {
      title: row.title,
      slug: row.slug,
      description: row.description,
      instructions: row.instructions,
      servings: row.servings,
      prepTime: row.prep_time,
      cookTime: row.cook_time,
      tags: row.tags || [],
      source: row.source,
      sourceUrl: row.source_url,
      photoUrl,
      requiredCookware: cookware.map((c: { name: string }) => c.name),
      ingredients: ingredients.map((i: { ingredient_name: string; quantity: number | null; unit: string | null }) => ({
        ingredientName: i.ingredient_name,
        quantity: i.quantity,
        unit: i.unit,
      })),
    };

    const ics = generateRecipeICS(recipe);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.status(200).send(ics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).send(`Failed to generate ICS: ${msg}`);
  }
}
