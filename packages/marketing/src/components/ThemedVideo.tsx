import { useThemeVideo } from '../hooks/useThemeVideo';
import LazyVideo from './LazyVideo';

interface ThemedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  name: string;
  caption?: string;
  figureClassName?: string;
  captionClassName?: string;
}

/**
 * A video element that swaps its source to match the active theme palette and mode.
 * Lazy-loaded via IntersectionObserver with a skeleton placeholder.
 * Uses key={prefix} to force remount when the theme changes.
 */
export default function ThemedVideo({
  name,
  caption,
  figureClassName,
  captionClassName,
  ...videoProps
}: ThemedVideoProps) {
  const { webm, mp4, poster, prefix } = useThemeVideo(name);

  return (
    <figure className={figureClassName}>
      <div />
      <LazyVideo
        key={prefix}
        poster={poster}
        preload="metadata"
        aria-label={caption ? `Demo: ${caption}` : undefined}
        {...videoProps}
      >
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </LazyVideo>
      {caption && (
        <figcaption className={captionClassName}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
