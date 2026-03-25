import type { NextApiRequest, NextApiResponse } from 'next';
import { IncomingForm, File } from 'formidable';
import { promises as fs } from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { processUploadedImage } from '../../lib/image-server';

export const config = {
  api: {
    bodyParser: false,
  },
};

/**
 * Upload handler for recipe photos and other images.
 *
 * Files are stored with UUID filenames (e.g. a1b2c3d4-...jpg). The SW and
 * browser cache these as immutable — NEVER overwrite an existing upload path.
 * If an image needs to be replaced, upload a new file (new UUID) and update
 * the recipe's photoUrl. The old file can be cleaned up separately.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
  await fs.mkdir(uploadsDir, { recursive: true });

  const form = new IncomingForm({
    uploadDir: uploadsDir,
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10 MB
  });

  return new Promise<void>((resolve) => {
    form.parse(req, async (err, _fields, files) => {
      if (err) {
        res.status(400).json({ error: err.message });
        return resolve();
      }

      const fileField = files.file;
      const file: File | undefined = Array.isArray(fileField) ? fileField[0] : fileField;
      if (!file) {
        res.status(400).json({ error: 'No file uploaded' });
        return resolve();
      }

      const ext = path.extname(file.originalFilename ?? '.jpg').toLowerCase() || '.jpg';
      const allowed = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
      if (!allowed.includes(ext)) {
        await fs.unlink(file.filepath).catch(() => {});
        res.status(400).json({ error: 'Invalid file type' });
        return resolve();
      }

      const uuid = randomUUID();
      const filename = `${uuid}${ext}`;
      const dest = path.join(uploadsDir, filename);
      await fs.rename(file.filepath, dest);

      // Generate responsive variants (WebP, JPEG, grayscale) in background.
      // Don't block the response — variants are a progressive enhancement.
      processUploadedImage(dest, uploadsDir, uuid).catch((e) =>
        console.error('[upload] Failed to generate image variants:', e),
      );

      res.json({ url: `/uploads/${filename}` });
      resolve();
    });
  });
}
