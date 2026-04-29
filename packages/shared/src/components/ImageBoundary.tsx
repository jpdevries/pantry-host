/**
 * Error boundary for the recipe-detail hero image area.
 *
 * Wraps `<ResponsiveImage>` / `<PixabayImage>` / plain `<img>` so a render
 * throw from anywhere in the image subtree (malformed URL, photo decoding,
 * future regression) doesn't unmount the rest of the page. The fallback
 * preserves the same `aspect-[16/9]` box the live image uses, so the
 * surrounding layout doesn't reflow on a swap.
 *
 * Today's image components catch their own async failures and don't throw
 * to render-time consumers — this is defense-in-depth, not load-bearing.
 */
import { Component, type ReactNode } from 'react';
import { CookingPot } from '@phosphor-icons/react';

interface Props {
  children: ReactNode;
  /** Optional alt-style label for the fallback (e.g. recipe title). */
  alt?: string;
}

interface State {
  hasError: boolean;
}

export default class ImageBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // Surface in pm2/console so a regression is visible. Same prefix style
    // as the GSSP error log (`[recipes/[slug]]`) for grep-ability.
    console.error('[ImageBoundary] hero image render threw:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          className="mb-8 aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)] flex items-center justify-center"
          role="img"
          aria-label={this.props.alt ? `${this.props.alt} (image unavailable)` : 'Recipe photo unavailable'}
        >
          <CookingPot size={64} weight="light" aria-hidden className="text-[var(--color-text-secondary)] opacity-40" />
        </div>
      );
    }
    return this.props.children;
  }
}
