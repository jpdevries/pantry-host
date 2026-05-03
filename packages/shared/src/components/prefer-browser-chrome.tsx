/**
 * Context for the PREFER_BROWSER_CHROME setting.
 *
 * Each package wraps its root with <PreferBrowserChromeProvider value={…}>;
 * shared components (most notably <IngredientTypeahead>) read via
 * usePreferBrowserChrome() to decide whether to render their custom UI or
 * fall back to native browser chrome (`<datalist>` / `<select>`).
 *
 * The Provider is package-agnostic — app fetches /api/settings-read; web
 * reads localStorage. Both shapes resolve to the same boolean.
 */

import { createContext, useContext } from 'react';

const PreferBrowserChromeContext = createContext<boolean>(false);

export const PreferBrowserChromeProvider = PreferBrowserChromeContext.Provider;

export function usePreferBrowserChrome(): boolean {
  return useContext(PreferBrowserChromeContext);
}
