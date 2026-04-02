import type { NextApiRequest, NextApiResponse } from 'next';
import sql from '@/lib/db';
import { generateRecipeICS, type ExportableRecipe } from '@pantry-host/shared/export-recipe';

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

    const ics = generateRecipeICS(recipe);

    res.setHeader('Content-Type', 'text/calendar; charset=utf-8');
    res.status(200).send(ics);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).send(`Failed to generate ICS: ${msg}`);
  }
}
