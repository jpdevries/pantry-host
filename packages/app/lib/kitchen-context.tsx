import { createContext, useContext, type ReactNode } from 'react';
import { useRouter } from 'next/router';

/**
 * Single source of truth for the active kitchen slug.
 *
 * Derives from `router.asPath` (reliable in both SSR and client, unlike
 * `router.query` — CLAUDE.md gotcha #9). Defaults to `'home'` when the
 * path doesn't include a `/kitchens/:slug` segment — i.e. the top-level
 * aliases `/`, `/recipes`, `/menus`, …, which the edge middleware
 * 308-redirects from `/kitchens/home/…`.
 *
 * Pages consume via `useKitchen()`. Do not prop-drill the slug and do
 * not recompute it per-component — consumers MUST read through this
 * context so there's exactly one resolution path and empty strings
 * can't silently leak into `/kitchens/${kitchen}/…` templates.
 */
const KitchenContext = createContext<string>('home');

function resolveSlug(asPath: string): string {
  const m = asPath.match(/^\/kitchens\/([^/?#]+)/);
  return m?.[1] ?? 'home';
}

export function KitchenProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  return (
    <KitchenContext.Provider value={resolveSlug(router.asPath)}>
      {children}
    </KitchenContext.Provider>
  );
}

export function useKitchen(): string {
  return useContext(KitchenContext);
}
