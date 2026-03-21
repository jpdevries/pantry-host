import { useState, useEffect } from 'react';
import { Monitor, Sun, Moon } from '@phosphor-icons/react';
import {
  getThemePreference,
  setThemePreference,
  getHighContrast,
  setHighContrast,
  getThemePalette,
  setThemePalette,
  type ThemePreference,
  type ThemePalette,
} from '../theme';

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Monitor }[] = [
  { value: 'system', label: 'System', Icon: Monitor },
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
];

const PALETTE_OPTIONS: { value: ThemePalette; label: string }[] = [
  { value: 'default', label: 'Default' },
  { value: 'rose', label: 'Rosé' },
{ value: 'rebecca', label: 'Rebecca Purple' },
  { value: 'claude', label: 'Claude' },
];

function LogoJP({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 106.22 119.76" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M73.11,10.12V129.88l17-17V96a23.81,23.81,0,0,0,23.08-6.16l1.5-1.51h0l1.45-1.44a23.85,23.85,0,0,0,0-33.72ZM101.69,75.4c-4.84,4.84-8.43,2.68-11.58-.25V52.41l9.73,9.72C103.42,65.73,107.42,69.68,101.69,75.4Z" transform="translate(-16.89 -10.12)" />
      <path d="M49.9,27.14V87.6l-9.73-9.73c-3.6-3.59-7.59-7.53-1.85-13.28C41,61.87,43.44,61.3,45.67,62V47.57a4.3,4.3,0,0,0-3.15-4l-.17,0-.51-.08a7.31,7.31,0,0,0-1.76,0,23.75,23.75,0,0,0-13.22,6.7l-2.68,2.68h0l-.3.3a23.83,23.83,0,0,0,0,33.72l43,43V10.12l-17,17v0Z" transform="translate(-16.89 -10.12)" />
    </svg>
  );
}

export default function Footer() {
  const [theme, setTheme] = useState<ThemePreference>('system');
  const [hc, setHC] = useState(false);
  const [palette, setPalette] = useState<ThemePalette>('default');

  useEffect(() => {
    setTheme(getThemePreference());
    setHC(getHighContrast());
    setPalette(getThemePalette());
  }, []);

  function handleTheme(pref: ThemePreference) {
    setTheme(pref);
    setThemePreference(pref);
  }

  function handleHC(enabled: boolean) {
    setHC(enabled);
    setHighContrast(enabled);
  }

  function handlePalette(p: ThemePalette) {
    setPalette(p);
    setThemePalette(p);
  }

  return (
    <footer className="no-print border-t border-zinc-200 dark:border-zinc-800 mt-16 pt-10 pb-8 px-4 sm:px-6 text-xs text-zinc-500 dark:text-zinc-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Volume</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 cup</dt> <dd className="inline">= 16 <abbr title="tablespoons">tbsp</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="tablespoon">tbsp</abbr></dt> <dd className="inline">= 3 <abbr title="teaspoons">tsp</abbr></dd></div>
              <div><dt className="inline font-medium">1 cup</dt> <dd className="inline">= 237 <abbr title="millilitres">ml</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="fluid ounce">fl oz</abbr></dt> <dd className="inline">= 30 <abbr title="millilitres">ml</abbr></dd></div>
              <div><dt className="inline font-medium">1 quart</dt> <dd className="inline">= 4 cups</dd></div>
              <div><dt className="inline font-medium">1 gallon</dt> <dd className="inline">= 4 quarts</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Weight</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 <abbr title="ounce">oz</abbr></dt> <dd className="inline">= 28.35 <abbr title="grams">g</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="pound">lb</abbr></dt> <dd className="inline">= 16 <abbr title="ounces">oz</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="pound">lb</abbr></dt> <dd className="inline">= 454 <abbr title="grams">g</abbr></dd></div>
              <div><dt className="inline font-medium">1 <abbr title="kilogram">kg</abbr></dt> <dd className="inline">= 2.2 <abbr title="pounds">lb</abbr></dd></div>
              <div><dt className="inline font-medium">1 stick butter</dt> <dd className="inline">= 113 <abbr title="grams">g</abbr></dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Temperature</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">250 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 121 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">350 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 177 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">400 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 204 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">450 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 232 <abbr title="Celsius">°C</abbr></dd></div>
              <div><dt className="inline font-medium">750 <abbr title="Fahrenheit">°F</abbr></dt> <dd className="inline">= 399 <abbr title="Celsius">°C</abbr></dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Handy</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 clove garlic</dt> <dd className="inline">≈ 1 <abbr title="teaspoon">tsp</abbr></dd></div>
              <div><dt className="inline font-medium">1 lemon</dt> <dd className="inline">≈ 3 <abbr title="tablespoons">tbsp</abbr> juice</dd></div>
              <div><dt className="inline font-medium">1 lime</dt> <dd className="inline">≈ 2 <abbr title="tablespoons">tbsp</abbr> juice</dd></div>
              <div><dt className="inline font-medium">1 egg</dt> <dd className="inline">≈ 50 <abbr title="grams">g</abbr></dd></div>
              <div><dt className="inline font-medium">Pinch</dt> <dd className="inline">≈ ⅛ <abbr title="teaspoon">tsp</abbr></dd></div>
            </dl>
          </div>
        </div>
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-6 mt-2">
          <p className="font-serif font-bold text-sm text-zinc-700 dark:text-zinc-300" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>Pantry Host</p>
          <p className="mt-2 legible text-zinc-500 dark:text-zinc-400 pretty">
            An open source, self-hosted kitchen companion that runs entirely on your home network or mobile&nbsp;device.<br/>Your recipes, your data, your&nbsp;machine.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            <span className="font-medium">Accessibility:</span> We strive to meet Level AA of the latest WCAG accessibility guidelines so that Pantry Host is as accessible to everyone as&nbsp;possible.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            <span className="font-medium">Privacy:</span> Pantry Host stores all data locally on your machine&nbsp;&mdash; nothing is sent to external servers. No accounts, no tracking, no analytics. If you choose to enable AI features, requests are sent directly to the Anthropic API using your own key and are not stored or used for&nbsp;training.
          </p>
          <p className="mt-1.5 legible text-zinc-500 dark:text-zinc-400 pretty">
            Optionally enhanced by <a href="https://claude.ai/download" className="hover:underline text-zinc-600 dark:text-zinc-300">Claude&nbsp;Code</a>&nbsp;&mdash; import recipes from any URL, generate new ones from what you have on hand, and manage your pantry conversationally. AI features require an API key and are entirely&nbsp;opt&#8209;in.
          </p>

          {/* Theme toggle + GitHub */}
          <div className="mt-6 flex flex-wrap items-center justify-between gap-y-3">
            <div className="flex flex-wrap items-center gap-4 gap-y-3">
              {/* Theme preference */}
              <div role="radiogroup" aria-label="Theme" className="flex items-center gap-1">
                {THEME_OPTIONS.map(({ value, label, Icon }) => {
                  const active = theme === value;
                  return (
                    <button
                      key={value}
                      role="radio"
                      aria-checked={active}
                      aria-label={`${label} theme`}
                      onClick={() => handleTheme(value)}
                      className={`p-1.5 rounded transition-colors ${
                        active
                          ? 'bg-zinc-200 dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100'
                          : 'text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400'
                      }`}
                    >
                      <Icon size={16} aria-hidden />
                    </button>
                  );
                })}
              </div>

              {/* Palette selector */}
              <label className="flex items-center gap-1.5 select-none">
                <span className="text-xs">Palette</span>
                <select
                  value={palette}
                  onChange={(e) => handlePalette(e.target.value as ThemePalette)}
                  className="text-xs bg-transparent border border-zinc-300 dark:border-zinc-700 rounded px-1.5 py-0.5"
                  aria-label="Color palette"
                >
                  {PALETTE_OPTIONS.map(({ value, label }) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </label>

              {/* High contrast toggle */}
              <label className="flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={hc}
                  onChange={(e) => handleHC(e.target.checked)}
                  className="w-3.5 h-3.5 accent-accent"
                />
                <span className="text-xs">High contrast</span>
              </label>
            </div>

            <a href="https://github.com/jpdevries/pantry-host" className="ml-auto text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors" aria-label="Pantry Host on GitHub">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z"/>
              </svg>
            </a>
          </div>

          {/* Credits */}
          <details className="credits-details sm:text-left text-center">
            <summary className="inline-flex items-center gap-1.5 text-xs bg-transparent rounded px-1.5 py-0.5 cursor-pointer select-none hover:underline list-none [&::-webkit-details-marker]:hidden text-zinc-500 dark:text-zinc-400 outline-none">
              Credits
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512" width={8} height={8} fill="currentColor" aria-hidden="true" className="credits-chevron">
                <path d="M443.5 162.6l-7.1-7.1c-4.7-4.7-12.3-4.7-17 0L224 351 28.5 155.5c-4.7-4.7-12.3-4.7-17 0l-7.1 7.1c-4.7 4.7-4.7 12.3 0 17l211 211.1c4.7 4.7 12.3 4.7 17 0l211-211.1c4.8-4.7 4.8-12.3.1-17z" />
              </svg>
            </summary>
            <div className="grid grid-cols-4 sm:grid-cols-6 gap-4 items-center" style={{ paddingTop: '0.25rem' }}>
              {/* @ts-expect-error inert is valid HTML but React types lag behind */}
              <a href="https://devries.jp" rel="nofollow" inert="" className="text-zinc-400 dark:text-zinc-600 hover:text-zinc-600 dark:hover:text-zinc-400 transition-colors" aria-label="JP DeVries">
                <LogoJP size={28} />
              </a>
            </div>
          </details>
        </div>
      </div>
    </footer>
  );
}
