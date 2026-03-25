/**
 * Client-safe responsive image helpers.
 * No Node built-ins (path, fs) or native modules (sharp) — safe for Rex bundling.
 */

/** Widths to generate for responsive images. Heights are 16:9. */
const VARIANT_WIDTHS = [400, 800, 1200] as const;

/** Compute 16:9 height for a given width. */
function heightFor(width: number): number {
  return Math.round((width * 9) / 16);
}

/**
 * Derive responsive image props from a photoUrl.
 *
 * Returns srcset strings for WebP, JPEG, and grayscale JPEG variants,
 * or null if the URL is external (not a local upload).
 */
export function getResponsiveProps(photoUrl: string) {
  if (!photoUrl.startsWith('/uploads/')) return null;

  // Extract base name from path: /uploads/{name}.{ext}
  const lastSlash = photoUrl.lastIndexOf('/');
  const basename = photoUrl.substring(lastSlash + 1);
  const dotIndex = basename.lastIndexOf('.');
  if (dotIndex < 0) return null;
  const uuid = basename.substring(0, dotIndex);

  const webpSrcSet = VARIANT_WIDTHS
    .map((w) => `/uploads/${uuid}-${w}.webp ${w}w`)
    .join(', ');

  const jpegSrcSet = VARIANT_WIDTHS
    .map((w) => `/uploads/${uuid}-${w}.jpg ${w}w`)
    .join(', ');

  const graySrcSet = VARIANT_WIDTHS
    .map((w) => `/uploads/${uuid}-${w}-gray.jpg ${w}w`)
    .join(', ');

  return {
    webpSrcSet,
    jpegSrcSet,
    graySrcSet,
    // Largest variant dimensions (for width/height attributes to prevent CLS)
    width: 1200,
    height: heightFor(1200),
    // Fallback src (middle variant JPEG)
    fallbackSrc: `/uploads/${uuid}-800.jpg`,
  };
}
