/**
 * Context for the PREFER_BROWSER_CHROME setting + touch-first auto-flip.
 *
 * Tri-state user pref:
 *   - `'on'`        — user explicitly opted in. Always native.
 *   - `'off'`       — user explicitly opted out. Always custom (overrides
 *                     the touch-first auto-flip).
 *   - `undefined`   — user hasn't expressed a preference yet. Defaults to
 *                     the runtime check `(hover: none) and (pointer: coarse)`,
 *                     which fires native on iPhone / iPad-touch / Android-phone
 *                     while keeping desktop on the custom typeahead.
 *
 * Each package wraps its root with <PreferBrowserChromeProvider userPref={…}>:
 *   - app fetches /api/settings-read for the user's stored preference and
 *     maps null/'true'/'false' → undefined/'on'/'off'
 *   - web reads localStorage with the same mapping
 *
 * Shared components (most notably <IngredientTypeahead>) read via
 * usePreferBrowserChrome() and don't care which path triggered native.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

export type PreferBrowserChromeUserPref = 'on' | 'off' | undefined;

const PreferBrowserChromeContext = createContext<boolean>(false);

interface ProviderProps {
  /** The user's explicit preference. `undefined` = no preference, fall through
   *  to the touch-first auto-detect. */
  userPref: PreferBrowserChromeUserPref;
  children: ReactNode;
}

export function PreferBrowserChromeProvider({ userPref, children }: ProviderProps) {
  const [touchFirst, setTouchFirst] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(hover: none) and (pointer: coarse)');
    setTouchFirst(mq.matches);
    // Listen for runtime changes (e.g. user attaches a Magic Keyboard to an
    // iPad and the device flips from touch-first to hover-capable).
    const listener = (e: MediaQueryListEvent) => setTouchFirst(e.matches);
    mq.addEventListener('change', listener);
    return () => mq.removeEventListener('change', listener);
  }, []);
  const effective =
    userPref === 'on' ? true :
    userPref === 'off' ? false :
    touchFirst;
  return (
    <PreferBrowserChromeContext.Provider value={effective}>
      {children}
    </PreferBrowserChromeContext.Provider>
  );
}

/** Returns the effective preference (`userPref || touchFirst`). True = render
 *  native chrome; false = render custom typeahead. */
export function usePreferBrowserChrome(): boolean {
  return useContext(PreferBrowserChromeContext);
}

/** Helper for the parent that reads the raw setting value from its package's
 *  store. Maps the wire format ('true' | 'false' | null | undefined) into the
 *  tri-state userPref the Provider expects. */
export function rawToUserPref(raw: string | null | undefined): PreferBrowserChromeUserPref {
  if (raw === 'true') return 'on';
  if (raw === 'false') return 'off';
  return undefined;
}
