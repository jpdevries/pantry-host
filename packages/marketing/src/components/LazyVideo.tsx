import { useState, useRef, useEffect } from 'react';

interface LazyVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  /** Aspect ratio string for the skeleton placeholder (e.g. "374/812") */
  aspectRatio?: string;
}

/**
 * Renders a skeleton placeholder until the element scrolls into view,
 * then swaps to a real <video> element. Defers all video network
 * requests until needed.
 */
export default function LazyVideo({ aspectRatio = '374/812', children, ...videoProps }: LazyVideoProps) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  if (!inView) {
    return (
      <div
        ref={ref}
        className="animate-pulse bg-[var(--color-accent-subtle)] rounded-xl"
        style={{ aspectRatio }}
      />
    );
  }

  return (
    <video ref={undefined} {...videoProps}>
      {children}
    </video>
  );
}
