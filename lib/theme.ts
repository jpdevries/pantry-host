/**
 * Theme management — respects system preferences by default.
 *
 * "system" (default): mirrors prefers-color-scheme via matchMedia listener
 * "light" / "dark": manual override, ignores OS preference
 *
 * High contrast is an independent toggle layered on top.
 * Palette (default / rose / plum) controls the color scheme.
 */

export type ThemePreference = 'system' | 'light' | 'dark';
export type ThemePalette = 'default' | 'rose' | 'rebecca' | 'claude';

const THEME_KEY = 'theme-preference';
const HC_KEY = 'high-contrast';
const PALETTE_KEY = 'theme-palette';

const PALETTE_CLASSES = ['theme-rose', 'theme-rebecca', 'theme-claude'] as const;

export function getThemePreference(): ThemePreference {
  if (typeof window === 'undefined') return 'system';
  return (localStorage.getItem(THEME_KEY) as ThemePreference) || 'system';
}

export function setThemePreference(pref: ThemePreference) {
  if (pref === 'system') {
    localStorage.removeItem(THEME_KEY);
  } else {
    localStorage.setItem(THEME_KEY, pref);
  }
  applyTheme();
}

export function getHighContrast(): boolean {
  if (typeof window === 'undefined') return false;
  // Check explicit user preference first, then OS preference
  const stored = localStorage.getItem(HC_KEY);
  if (stored !== null) return stored === 'true';
  // Auto-detect from OS
  return window.matchMedia('(prefers-contrast: more)').matches;
}

export function setHighContrast(enabled: boolean) {
  // Always store explicitly once the user interacts with the toggle
  localStorage.setItem(HC_KEY, enabled ? 'true' : 'false');
  applyTheme();
}

export function getThemePalette(): ThemePalette {
  if (typeof window === 'undefined') return 'default';
  const stored = localStorage.getItem(PALETTE_KEY) as ThemePalette | null;
  if (stored) return stored;
  // Fall back to server-injected default (e.g. Claude Code sets <meta name="default-palette" content="claude">)
  const meta = document.querySelector<HTMLMetaElement>('meta[name="default-palette"]');
  return (meta?.content as ThemePalette) || 'default';
}

export function setThemePalette(palette: ThemePalette) {
  if (palette === 'default') {
    localStorage.removeItem(PALETTE_KEY);
  } else {
    localStorage.setItem(PALETTE_KEY, palette);
  }
  applyTheme();
}

export function applyTheme() {
  if (typeof document === 'undefined') return;

  const pref = getThemePreference();
  const el = document.documentElement;

  let dark: boolean;
  if (pref === 'system') {
    dark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  } else {
    dark = pref === 'dark';
  }

  el.classList.toggle('dark', dark);
  el.style.colorScheme = dark ? 'dark' : 'light';

  // High contrast
  const hc = getHighContrast();
  el.classList.toggle('high-contrast', hc);

  // Palette
  const palette = getThemePalette();
  for (const cls of PALETTE_CLASSES) {
    el.classList.remove(cls);
  }
  if (palette === 'rose') el.classList.add('theme-rose');
  if (palette === 'rebecca') el.classList.add('theme-rebecca');
  if (palette === 'claude') el.classList.add('theme-claude');
}

let listenerRegistered = false;

export function initTheme() {
  applyTheme();

  if (listenerRegistered) return;
  listenerRegistered = true;

  // Listen for OS dark mode changes — only matters when preference is "system"
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (getThemePreference() === 'system') {
      applyTheme();
    }
  });

  // Listen for OS high-contrast changes — auto-sync if user hasn't explicitly set it
  window.matchMedia('(prefers-contrast: more)').addEventListener('change', () => {
    if (localStorage.getItem(HC_KEY) === null) {
      applyTheme();
    }
  });
}
