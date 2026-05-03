/**
 * Context for the PREFER_BROWSER_CHROME setting + touch-first auto-flip.
 *
 * Each package wraps its root with <PreferBrowserChromeProvider userPref={…}>:
 *   - app fetches /api/settings-read for the user's stored preference
 *   - web reads localStorage
 *
 * The Provider OR-s that user pref with a runtime check for touch-first
 * devices (`(hover: none) and (pointer: coarse)`). On iPhone / iPad-touch /
 * Android-phone the native fallback is the right default — gives the user
 * iOS Safari's keyboard-bar `<datalist>` suggestions on segmented inputs and
 * the OS picker on `<select>`s. Desktop / mouse keeps the custom typeahead.
 *
 * Touch detection runs after mount via useEffect so SSR + first client
 * render agree (both `false`); the second client render flips it on if the
 * device is touch-first. Keeps hydration stable.
 *
 * Shared components (most notably <IngredientTypeahead>) read via
 * usePreferBrowserChrome() and don't care which path triggered native.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const PreferBrowserChromeContext = createContext<boolean>(false);

interface ProviderProps {
  /** The user's explicit preference (from settings — env var on app, localStorage on web). */
  userPref: boolean;
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
  return (
    <PreferBrowserChromeContext.Provider value={userPref || touchFirst}>
      {children}
    </PreferBrowserChromeContext.Provider>
  );
}

export function usePreferBrowserChrome(): boolean {
  return useContext(PreferBrowserChromeContext);
}
