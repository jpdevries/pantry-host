import React from 'react';
import { getResponsiveProps } from '../lib/image';

interface ResponsiveImageProps {
  src: string;
  alt: string;
  className?: string;
  loading?: 'lazy' | 'eager';
  sizes?: string;
}

/**
 * Renders a responsive `<picture>` element for local uploads with:
 *   1. Grayscale JPEG source for @media (monochrome) — e-ink/monochrome displays
 *   2. WebP source for modern browsers
 *   3. JPEG fallback <img> with srcset
 *
 * External URLs (not starting with /uploads/) render as a plain <img>.
 * All images include width/height attributes to prevent layout shift (CLS).
 */
export default function ResponsiveImage({
  src,
  alt,
  className,
  loading,
  sizes,
}: ResponsiveImageProps) {
  const responsive = getResponsiveProps(src);

  if (!responsive) {
    // External URL — plain img with CLS-preventing dimensions
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        width={1200}
        height={675}
      />
    );
  }

  return (
    <picture>
      {/* Monochrome/e-ink displays get pre-rendered grayscale */}
      <source
        media="(monochrome)"
        srcSet={responsive.graySrcSet}
        sizes={sizes}
      />
      {/* Modern browsers get WebP */}
      <source
        type="image/webp"
        srcSet={responsive.webpSrcSet}
        sizes={sizes}
      />
      {/* JPEG fallback with srcset for older browsers */}
      <img
        src={responsive.fallbackSrc}
        srcSet={responsive.jpegSrcSet}
        sizes={sizes}
        alt={alt}
        width={responsive.width}
        height={responsive.height}
        className={className}
        loading={loading}
      />
    </picture>
  );
}
