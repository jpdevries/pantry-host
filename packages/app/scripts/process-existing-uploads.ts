/**
 * Migration script: generate responsive image variants for existing uploads.
 *
 * Reads all files in public/uploads/, identifies originals (no size suffix),
 * and generates WebP, JPEG, and grayscale JPEG variants at 400/800/1200 widths.
 *
 * Idempotent — skips files that already have variants.
 *
 * Usage: npx tsx packages/app/scripts/process-existing-uploads.ts
 */

import { promises as fs } from 'fs';
import path from 'path';
import { processUploadedImage } from '../lib/image';

const UPLOADS_DIR = path.join(process.cwd(), 'packages', 'app', 'public', 'uploads');

async function main() {
  let files: string[];
  try {
    files = await fs.readdir(UPLOADS_DIR);
  } catch {
    console.error(`Uploads directory not found: ${UPLOADS_DIR}`);
    process.exit(1);
  }

  // Identify originals: files without a size suffix (e.g., uuid.jpg, not uuid-400.jpg)
  const originals = files.filter((f) => {
    // Skip variant files (contain -400, -800, -1200, or -gray)
    if (/-\d+\./.test(f) || /-gray\./.test(f)) return false;
    // Must be an image
    return /\.(jpg|jpeg|png|webp|gif)$/i.test(f);
  });

  console.log(`Found ${originals.length} original upload(s) in ${UPLOADS_DIR}`);

  let processed = 0;
  let skipped = 0;

  for (const filename of originals) {
    const dotIndex = filename.lastIndexOf('.');
    const uuid = filename.substring(0, dotIndex);

    // Check if variants already exist (look for the 800w webp as indicator)
    const variantCheck = path.join(UPLOADS_DIR, `${uuid}-800.webp`);
    try {
      await fs.access(variantCheck);
      console.log(`  ✓ ${filename} — variants exist, skipping`);
      skipped++;
      continue;
    } catch {
      // Variants don't exist, proceed
    }

    const inputPath = path.join(UPLOADS_DIR, filename);
    try {
      await processUploadedImage(inputPath, UPLOADS_DIR, uuid);
      processed++;
      console.log(`  ✓ ${filename} — generated variants`);
    } catch (err) {
      console.error(`  ✗ ${filename} — failed:`, err);
    }
  }

  console.log(`\nDone. Processed: ${processed}, Skipped: ${skipped}, Total: ${originals.length}`);
}

main();
