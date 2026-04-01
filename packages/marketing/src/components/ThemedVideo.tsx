import { useThemeVideo } from '../hooks/useThemeVideo';

interface ThemedVideoProps extends React.VideoHTMLAttributes<HTMLVideoElement> {
  name: string;
  caption?: string;
  figureClassName?: string;
  captionClassName?: string;
}

/**
 * A video element that swaps its source to match the active theme palette and mode.
 * Uses key={src} to force remount when the theme changes — browsers don't re-evaluate
 * <source> elements dynamically.
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
      <video key={prefix} poster={poster} preload="metadata" aria-label={caption ? `Demo: ${caption}` : undefined} {...videoProps}>
        <source src={webm} type="video/webm" />
        <source src={mp4} type="video/mp4" />
      </video>
      {caption && (
        <figcaption className={captionClassName}>
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
