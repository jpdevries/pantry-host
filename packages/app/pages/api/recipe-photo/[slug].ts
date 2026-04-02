import type { NextApiRequest, NextApiResponse } from 'next';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import sql from '@/lib/db';

/**
 * Serves the optimized 400px recipe photo with a friendly filename.
 * Used by ICS calendar exports so iOS Calendar shows a readable
 * attachment name instead of a UUID.
 *
 * GET /api/recipe-photo/baby-banana-pancakes
 * → 200 image/jpeg (Content-Disposition: inline; filename="baby-banana-pancakes.jpg")
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const slug = (req.query.slug as string)?.replace(/\.jpg$/, '');
  if (!slug) return res.status(400).end();

  try {
    const [row] = await sql`SELECT photo_url FROM recipes WHERE slug = ${slug}`;
    if (!row?.photo_url?.startsWith('/uploads/')) return res.status(404).end();

    const uuid = row.photo_url.replace('/uploads/', '').replace(/\.[^.]+$/, '');
    const variantPath = join(process.cwd(), 'public', 'uploads', `${uuid}-400.jpg`);

    // Fall back to original if 400px variant doesn't exist
    const originalPath = join(process.cwd(), 'public', row.photo_url);
    const filePath = existsSync(variantPath) ? variantPath : existsSync(originalPath) ? originalPath : null;

    if (!filePath) return res.status(404).end();

    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Content-Disposition', `inline; filename="${slug}.jpg"`);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    res.status(200).send(readFileSync(filePath));
  } catch {
    res.status(500).end();
  }
}
