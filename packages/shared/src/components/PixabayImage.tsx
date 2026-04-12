/**
 * Borrowed Pixabay fallback image for recipe cards.
 *
 * Renders a 16:9 landscape photo queried by recipe title, with courtesy
 * photographer attribution overlaid at the bottom. Per-recipe cache in
 * localStorage means a given recipe is only ever queried once per
 * browser. Negative results (no match, rate limit, bad key) are also
 * cached so we don't re-hit the API on every render.
 *
 * Pixabay's Content License makes attribution optional, but we still
 * render the "Photo by {user} on Pixabay" overlay for transparency
 * and to keep the visual pattern consistent across sources.
 *
 * The parent decides *whether* to render this component at all —
 * i.e. the parent checks that the recipe has no photoUrl of its own,
 * that the feature is enabled, and that an API key is configured.
 * This component assumes all those preconditions are met.
 */
import { useEffect, useState } from 'react';
import { CookingPot } from '@phosphor-icons/react';
import {
  searchPixabayPhoto,
  getPixabayCacheEntry,
  savePixabayCacheEntry,
  withPixabayUtm,
  PIXABAY_ROOT_ATTRIBUTION,
  type PixabayHit,
} from '../pixabay';

interface Props {
  recipe: { id: string; title: string };
  apiKey: string;
  alt: string;
  /** When true, render nothing instead of the CookingPot placeholder
   *  for loading/miss states. Use on detail pages where a blank space
   *  is better than a faint icon in a hero slot. */
  hidePlaceholder?: boolean;
}

type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'hit'; hit: PixabayHit }
  | { status: 'miss' };

// Sessions-scoped flag so we only console.warn once per reload when a
// key is bad or rate-limited, not once per recipe card.
let warnedThisSession = false;

export default function PixabayImage({ recipe, apiKey, alt, hidePlaceholder }: Props) {
  const [state, setState] = useState<State>(() => {
    const cached = getPixabayCacheEntry(recipe.id);
    if (!cached) return { status: 'idle' };
    if (cached.failed) return { status: 'miss' };
    return { status: 'hit', hit: cached };
  });

  useEffect(() => {
    if (state.status !== 'idle' && state.status !== 'loading') return;
    let cancelled = false;
    setState({ status: 'loading' });
    searchPixabayPhoto(recipe.title, apiKey)
      .then((hit) => {
        if (cancelled) return;
        if (hit) {
          savePixabayCacheEntry(recipe.id, hit);
          setState({ status: 'hit', hit });
        } else {
          savePixabayCacheEntry(recipe.id, { failed: true, at: Date.now() });
          setState({ status: 'miss' });
        }
      })
      .catch((err) => {
        if (cancelled) return;
        if (!warnedThisSession) {
          // eslint-disable-next-line no-console
          console.warn('[pixabay]', (err as Error).message);
          warnedThisSession = true;
        }
        savePixabayCacheEntry(recipe.id, { failed: true, at: Date.now() });
        setState({ status: 'miss' });
      });
    return () => {
      cancelled = true;
    };
  }, [state.status, recipe.id, recipe.title, apiKey]);

  if (state.status === 'hit') {
    const hit = state.hit;
    return (
      <div className="relative aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
        <picture>
          <source srcSet={hit.urlWeb} media="(max-width: 480px)" />
          <img
            src={hit.urlLarge}
            alt={alt}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              // Upstream photo removed — hide the image; parent card
              // still looks reasonable with just the text below.
              (e.currentTarget as HTMLImageElement).style.display = 'none';
            }}
          />
        </picture>
        <div className="absolute bottom-0 left-0 right-0 px-2 py-1 bg-black/50 text-white text-[10px] leading-tight truncate text-right">
          Photo by{' '}
          <a
            href={withPixabayUtm(hit.pageUrl)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            onClick={(e) => e.stopPropagation()}
          >
            {hit.photographerName}
          </a>{' '}
          on{' '}
          <a
            href={PIXABAY_ROOT_ATTRIBUTION}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
            onClick={(e) => e.stopPropagation()}
          >
            Pixabay
          </a>
        </div>
      </div>
    );
  }

  // loading / idle / miss → placeholder (or nothing on detail pages)
  if (hidePlaceholder) return null;
  return (
    <div className="aspect-[16/9] flex items-center justify-center bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] opacity-30">
      <CookingPot size={48} weight="light" aria-hidden />
    </div>
  );
}
