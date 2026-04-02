import type { NextApiRequest, NextApiResponse } from 'next';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import sql from '@/lib/db';
import { generateRecipeICS, type ExportableRecipe } from '@pantry-host/shared/export-recipe';

/**
 * For local uploads (/uploads/uuid.ext), try to read the optimized
 * 400px JPEG variant and return it as base64. Returns undefined for
 * external URLs or if the variant doesn't exist.
 */
function getInlineImage(photoUrl: string | null): { base64: string; type: string } | undefined {
  if (!photoUrl || !photoUrl.startsWith('/uploads/')) return undefined;

  // /uploads/uuid.jpg → uuid
  const filename = photoUrl.replace('/uploads/', '');
  const uuid = filename.replace(/\.[^.]+$/, '');
  const variantPath = join(process.cwd(), 'public', 'uploads', `${uuid}-400.jpg`);

  if (!existsSync(variantPath)) return undefined;

  try {
    const buffer = readFileSync(variantPath);
    return { base64: buffer.toString('base64'), type: 'image/jpeg' };
  } catch {
    return undefined;
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
      photoUrl: row.photo_url,
      requiredCookware: cookware.map((c: { name: string }) => c.name),
      ingredients: ingredients.map((i: { ingredient_name: string; quantity: number | null; unit: string | null }) => ({
        ingredientName: i.ingredient_name,
        quantity: i.quantity,
        unit: i.unit,
      })),
    };

    const inlineImage = getInlineImage(row.photo_url);
    const ics = generateRecipeICS(recipe, inlineImage ? {
      inlineImageBase64: inlineImage.base64,
      inlineImageType: inlineImage.type,
    } : undefined);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.status(200).send(ics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).send(`Failed to generate ICS: ${msg}`);
  }
}
