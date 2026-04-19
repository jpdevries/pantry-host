/**
 * Client-side image downscale before multipart upload.
 *
 * Rex 0.20.0's Rust core enforces axum's ~2 MB request body limit and
 * doesn't honor Next.js's `bodyParser: false` config, so `/api/upload`
 * rejects typical phone-camera photos with `413 Failed to buffer the
 * request body`. Until Rex exposes a body-size knob, we normalize
 * oversized images in the browser. The server-side responsive pipeline
 * emits 400/800/1200-wide variants, so a 1500-wide input is
 * indistinguishable from a 4000-wide original after processing.
 *
 * Pure function, no React. Uses `createImageBitmap` + `OffscreenCanvas`
 * (or HTMLCanvasElement fallback) — standard Web APIs available in
 * Safari 17+, Chrome 94+.
 */

export interface DownscaleOptions {
  /** Longer edge, in pixels. Default 1500. */
  maxDimension?: number;
  /** Skip downscale when file is smaller than this AND within maxDimension². Default 1.8 MB. */
  maxBytes?: number;
  /** JPEG encode quality (0-1). Default 0.85. */
  quality?: number;
}

export async function downscaleIfLarge(file: File, opts: DownscaleOptions = {}): Promise<File> {
  const maxDimension = opts.maxDimension ?? 1500;
  const maxBytes = opts.maxBytes ?? 1.8 * 1024 * 1024;
  const quality = opts.quality ?? 0.85;

  if (!file.type.startsWith('image/')) return file;

  // Fast path: small files may still have huge pixel dimensions, so we
  // always need to peek at the bitmap. createImageBitmap is cheap —
  // it doesn't decode the full raster until drawImage.
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Decode failed (corrupt, unsupported). Let the server reject.
    return file;
  }

  const withinPixelBox = bitmap.width <= maxDimension && bitmap.height <= maxDimension;
  if (file.size < maxBytes && withinPixelBox) {
    bitmap.close?.();
    return file;
  }

  const scale = Math.min(1, maxDimension / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  let blob: Blob;
  if (typeof OffscreenCanvas !== 'undefined') {
    const canvas = new OffscreenCanvas(w, h);
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    blob = await canvas.convertToBlob({ type: 'image/jpeg', quality });
  } else {
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) { bitmap.close?.(); return file; }
    ctx.drawImage(bitmap, 0, 0, w, h);
    blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('toBlob failed'))), 'image/jpeg', quality);
    });
  }
  bitmap.close?.();

  const stem = file.name.replace(/\.[^.]+$/, '') || 'image';
  return new File([blob], `${stem}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}
