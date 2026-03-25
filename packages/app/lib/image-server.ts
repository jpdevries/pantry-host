/**
 * Server-only image processing with sharp.
 * NOT safe for browser bundling — uses Node built-ins (path, fs) and native modules (sharp).
 */
import sharp from 'sharp';
import path from 'path';

/** Widths to generate for responsive images. Heights are 16:9. */
const VARIANT_WIDTHS = [400, 800, 1200] as const;

/** Compute 16:9 height for a given width. */
function heightFor(width: number): number {
  return Math.round((width * 9) / 16);
}

/**
 * Process an uploaded image into responsive variants.
 *
 * For each target width, generates:
 *   - WebP (quality 80)
 *   - JPEG (quality 80)
 *   - Grayscale JPEG (quality 80) for @media (monochrome) / e-ink displays
 *
 * All variants are cropped to 16:9 aspect ratio (center crop).
 * GIF files are skipped to preserve animation.
 *
 * @param inputPath - Absolute path to the original uploaded file
 * @param uploadsDir - Absolute path to the uploads directory
 * @param uuid - The UUID used for the original filename (without extension)
 */
export async function processUploadedImage(
  inputPath: string,
  uploadsDir: string,
  uuid: string,
): Promise<void> {
  const ext = path.extname(inputPath).toLowerCase();

  // Skip GIFs — preserve animation
  if (ext === '.gif') return;

  const metadata = await sharp(inputPath).metadata();
  const originalWidth = metadata.width ?? 0;

  for (const width of VARIANT_WIDTHS) {
    // Don't upscale — skip if original is narrower than target
    if (originalWidth < width) continue;

    const height = heightFor(width);
    const resized = sharp(inputPath).resize(width, height, {
      fit: 'cover',
      position: 'centre',
    });

    await Promise.all([
      // WebP
      resized.clone().webp({ quality: 80 }).toFile(
        path.join(uploadsDir, `${uuid}-${width}.webp`),
      ),
      // JPEG
      resized.clone().jpeg({ quality: 80 }).toFile(
        path.join(uploadsDir, `${uuid}-${width}.jpg`),
      ),
      // Grayscale JPEG for monochrome/e-ink displays
      resized.clone().grayscale().jpeg({ quality: 80 }).toFile(
        path.join(uploadsDir, `${uuid}-${width}-gray.jpg`),
      ),
    ]);
  }
}
