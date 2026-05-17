import { useState, useEffect } from 'react';
import {
  CSS_VARS,
  getColorOverrides,
  setColorOverrides,
  getCurrentMode,
  getThemePalette,
  type CSSVar,
  type ThemePalette,
  type ColorOverrides,
} from '@pantry-host/shared/theme';

const TOKEN_LABELS: Record<CSSVar, string> = {
  '--color-bg-body': 'Body Background',
  '--color-bg-card': 'Card Background',
  '--color-border-card': 'Card Border',
  '--color-text-primary': 'Primary Text',
  '--color-text-secondary': 'Secondary Text',
  '--color-accent': 'Accent',
  '--color-accent-hover': 'Accent Hover',
  '--color-accent-subtle': 'Accent Subtle',
  '--color-bg-nav': 'Navigation Background',
  '--color-ring-focus': 'Focus Ring',
  '--color-ring-offset': 'Focus Ring Offset',
};

type PaletteDefaults = Record<string, Record<CSSVar, string>>;

const DEFAULTS: PaletteDefaults = {
  'default-light': {
    '--color-bg-body': '#f4f4f5',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#e4e4e7',
    '--color-text-primary': '#09090b',
    '--color-text-secondary': '#52525b',
    '--color-accent': '#18181b',
    '--color-accent-hover': '#09090b',
    '--color-accent-subtle': '#e4e4e7',
    '--color-bg-nav': '#f4f4f5',
    '--color-ring-focus': '#18181b',
    '--color-ring-offset': '#ffffff',
  },
  'default-dark': {
    '--color-bg-body': '#09090b',
    '--color-bg-card': '#18181b',
    '--color-border-card': '#27272a',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#a1a1aa',
    '--color-accent': '#e4e4e7',
    '--color-accent-hover': '#fafafa',
    '--color-accent-subtle': '#27272a',
    '--color-bg-nav': '#09090b',
    '--color-ring-focus': '#e4e4e7',
    '--color-ring-offset': '#09090b',
  },
  'rose-light': {
    '--color-bg-body': '#fff1f2',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#fecdd3',
    '--color-text-primary': '#2a0a0f',
    '--color-text-secondary': '#9f1239',
    '--color-accent': '#be123c',
    '--color-accent-hover': '#be123c',
    '--color-accent-subtle': '#ffe4e6',
    '--color-bg-nav': '#fff1f2',
    '--color-ring-focus': '#e11d48',
    '--color-ring-offset': '#ffffff',
  },
  'rose-dark': {
    '--color-bg-body': '#1a0a10',
    '--color-bg-card': '#2d1520',
    '--color-border-card': '#4a1d30',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#fda4af',
    '--color-accent': '#fb7185',
    '--color-accent-hover': '#fda4af',
    '--color-accent-subtle': '#3d1525',
    '--color-bg-nav': '#1a0a10',
    '--color-ring-focus': '#fb7185',
    '--color-ring-offset': '#1a0a10',
  },
  'rebecca-light': {
    '--color-bg-body': '#f3eef8',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#d8c8ed',
    '--color-text-primary': '#1a0a2e',
    '--color-text-secondary': '#553080',
    '--color-accent': '#663399',
    '--color-accent-hover': '#7c4dba',
    '--color-accent-subtle': '#e8ddf5',
    '--color-bg-nav': '#f3eef8',
    '--color-ring-focus': '#663399',
    '--color-ring-offset': '#ffffff',
  },
  'rebecca-dark': {
    '--color-bg-body': '#110a1f',
    '--color-bg-card': '#1c1230',
    '--color-border-card': '#33245a',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#c4a8e0',
    '--color-accent': '#b794d6',
    '--color-accent-hover': '#d1b8ec',
    '--color-accent-subtle': '#211640',
    '--color-bg-nav': '#110a1f',
    '--color-ring-focus': '#b794d6',
    '--color-ring-offset': '#110a1f',
  },
  'lilac-light': {
    '--color-bg-body': '#fefbce',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#e5d4ea',
    '--color-text-primary': '#2c1b3a',
    '--color-text-secondary': '#5a3f70',
    '--color-accent': '#7d5499',
    '--color-accent-hover': '#5f3f7a',
    '--color-accent-subtle': '#f0e1f4',
    '--color-bg-nav': '#fefbce',
    '--color-ring-focus': '#7d5499',
    '--color-ring-offset': '#ffffff',
  },
  'lilac-dark': {
    '--color-bg-body': '#2a1b3a',
    '--color-bg-card': '#372544',
    '--color-border-card': '#5a3f70',
    '--color-text-primary': '#fefbce',
    '--color-text-secondary': '#e5d4ea',
    '--color-accent': '#c8a2c9',
    '--color-accent-hover': '#d9bce0',
    '--color-accent-subtle': '#3d2750',
    '--color-bg-nav': '#2a1b3a',
    '--color-ring-focus': '#c8a2c9',
    '--color-ring-offset': '#2a1b3a',
  },
  'morning-butter-light': {
    '--color-bg-body': '#fbf2d8',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#dcc57c',
    '--color-text-primary': '#1a2942',
    '--color-text-secondary': '#3f5f8e',
    '--color-accent': '#3f5f8e',
    '--color-accent-hover': '#2d466f',
    '--color-accent-subtle': '#e5eef8',
    '--color-bg-nav': '#fbf2d8',
    '--color-ring-focus': '#3f5f8e',
    '--color-ring-offset': '#ffffff',
  },
  'morning-butter-dark': {
    '--color-bg-body': '#1a2942',
    '--color-bg-card': '#25344d',
    '--color-border-card': '#3f5f8e',
    '--color-text-primary': '#f3d98f',
    '--color-text-secondary': '#e2d5b8',
    '--color-accent': '#7298c7',
    '--color-accent-hover': '#95b4d8',
    '--color-accent-subtle': '#25344d',
    '--color-bg-nav': '#1a2942',
    '--color-ring-focus': '#7298c7',
    '--color-ring-offset': '#1a2942',
  },
  'claude-light': {
    '--color-bg-body': '#f8f8f7',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#e2e2e0',
    '--color-text-primary': '#1a1a1a',
    '--color-text-secondary': '#6b6b6b',
    '--color-accent': '#a07850',
    '--color-accent-hover': '#8c6844',
    '--color-accent-subtle': '#f2ede8',
    '--color-bg-nav': '#f8f8f7',
    '--color-ring-focus': '#c4956b',
    '--color-ring-offset': '#ffffff',
  },
  'claude-dark': {
    '--color-bg-body': '#191919',
    '--color-bg-card': '#262626',
    '--color-border-card': '#333333',
    '--color-text-primary': '#e8e8e8',
    '--color-text-secondary': '#8b8b8b',
    '--color-accent': '#c4956b',
    '--color-accent-hover': '#d4a57b',
    '--color-accent-subtle': '#231f1b',
    '--color-bg-nav': '#191919',
    '--color-ring-focus': '#c4956b',
    '--color-ring-offset': '#191919',
  },
  'claude-v1-light': {
    '--color-bg-body': '#f5f0eb',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#e0d5c8',
    '--color-text-primary': '#141413',
    '--color-text-secondary': '#7c4a2d',
    '--color-accent': '#a84f2a',
    '--color-accent-hover': '#9c4726',
    '--color-accent-subtle': '#f0e4d8',
    '--color-bg-nav': '#f5f0eb',
    '--color-ring-focus': '#d97757',
    '--color-ring-offset': '#ffffff',
  },
  'claude-v1-dark': {
    '--color-bg-body': '#1a1915',
    '--color-bg-card': '#2d2b28',
    '--color-border-card': '#3d3a35',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#d4a88a',
    '--color-accent': '#e8956d',
    '--color-accent-hover': '#f0b090',
    '--color-accent-subtle': '#2a2420',
    '--color-bg-nav': '#1a1915',
    '--color-ring-focus': '#e8956d',
    '--color-ring-offset': '#1a1915',
  },
  'avocado-light': {
    '--color-bg-body': '#f5f3eb',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#8c8668',
    '--color-text-primary': '#1a1f0a',
    '--color-text-secondary': '#4a5a20',
    '--color-accent': '#3d5c0f',
    '--color-accent-hover': '#345010',
    '--color-accent-subtle': '#e8e6d0',
    '--color-bg-nav': '#f5f3eb',
    '--color-ring-focus': '#c05a0e',
    '--color-ring-offset': '#ffffff',
  },
  'avocado-dark': {
    '--color-bg-body': '#332A32',
    '--color-bg-card': '#443c48',
    '--color-border-card': '#5a5060',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#b5c882',
    '--color-accent': '#95bc48',
    '--color-accent-hover': '#a8d055',
    '--color-accent-subtle': '#2a3028',
    '--color-bg-nav': '#332A32',
    '--color-ring-focus': '#E66E11',
    '--color-ring-offset': '#332A32',
  },
  'marrakech-light': {
    '--color-bg-body': '#f5ede0',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#8a7050',
    '--color-text-primary': '#1f1408',
    '--color-text-secondary': '#8b4513',
    '--color-accent': '#9b2335',
    '--color-accent-hover': '#7a1c2a',
    '--color-accent-subtle': '#f0e0c8',
    '--color-bg-nav': '#f5ede0',
    '--color-ring-focus': '#b8860b',
    '--color-ring-offset': '#ffffff',
  },
  'marrakech-dark': {
    '--color-bg-body': '#1c1410',
    '--color-bg-card': '#2d2218',
    '--color-border-card': '#907050',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#dba86a',
    '--color-accent': '#e8a84c',
    '--color-accent-hover': '#f0c070',
    '--color-accent-subtle': '#302010',
    '--color-bg-nav': '#1c1410',
    '--color-ring-focus': '#e8a84c',
    '--color-ring-offset': '#1c1410',
  },
  'provencal-light': {
    '--color-bg-body': '#f5f0e8',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#8a8468',
    '--color-text-primary': '#1a1028',
    '--color-text-secondary': '#5c6838',
    '--color-accent': '#6b4c8a',
    '--color-accent-hover': '#573d78',
    '--color-accent-subtle': '#ece5d8',
    '--color-bg-nav': '#f5f0e8',
    '--color-ring-focus': '#6b4c8a',
    '--color-ring-offset': '#ffffff',
  },
  'provencal-dark': {
    '--color-bg-body': '#161418',
    '--color-bg-card': '#241e28',
    '--color-border-card': '#786888',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#c8b898',
    '--color-accent': '#c8a0d8',
    '--color-accent-hover': '#d8b8e8',
    '--color-accent-subtle': '#221828',
    '--color-bg-nav': '#161418',
    '--color-ring-focus': '#c8a0d8',
    '--color-ring-offset': '#161418',
  },
  'kaiseki-light': {
    '--color-bg-body': '#f4f1ec',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#8a8070',
    '--color-text-primary': '#141418',
    '--color-text-secondary': '#5a6848',
    '--color-accent': '#2d6040',
    '--color-accent-hover': '#1e4830',
    '--color-accent-subtle': '#e8e4d8',
    '--color-bg-nav': '#f4f1ec',
    '--color-ring-focus': '#c06030',
    '--color-ring-offset': '#ffffff',
  },
  'kaiseki-dark': {
    '--color-bg-body': '#141210',
    '--color-bg-card': '#201e1a',
    '--color-border-card': '#786858',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#b8c098',
    '--color-accent': '#88c498',
    '--color-accent-hover': '#a0d8b0',
    '--color-accent-subtle': '#1c1a18',
    '--color-bg-nav': '#141210',
    '--color-ring-focus': '#d08050',
    '--color-ring-offset': '#141210',
  },
  'tuscany-light': {
    '--color-bg-body': '#f5f0e0',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#8a7858',
    '--color-text-primary': '#1f1510',
    '--color-text-secondary': '#5c6030',
    '--color-accent': '#8b4520',
    '--color-accent-hover': '#703818',
    '--color-accent-subtle': '#ede5d0',
    '--color-bg-nav': '#f5f0e0',
    '--color-ring-focus': '#8b4520',
    '--color-ring-offset': '#ffffff',
  },
  'tuscany-dark': {
    '--color-bg-body': '#18150e',
    '--color-bg-card': '#282418',
    '--color-border-card': '#787050',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#c8b888',
    '--color-accent': '#d8a070',
    '--color-accent-hover': '#e8b888',
    '--color-accent-subtle': '#201c14',
    '--color-bg-nav': '#18150e',
    '--color-ring-focus': '#d8a070',
    '--color-ring-offset': '#18150e',
  },
  'oaxacan-light': {
    '--color-bg-body': '#f4f0e8',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#787898',
    '--color-text-primary': '#1a1008',
    '--color-text-secondary': '#4a4878',
    '--color-accent': '#b84820',
    '--color-accent-hover': '#a03c18',
    '--color-accent-subtle': '#e8e0d0',
    '--color-bg-nav': '#f4f0e8',
    '--color-ring-focus': '#2d5a40',
    '--color-ring-offset': '#ffffff',
  },
  'oaxacan-dark': {
    '--color-bg-body': '#141018',
    '--color-bg-card': '#201828',
    '--color-border-card': '#786890',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#d0a868',
    '--color-accent': '#e8a048',
    '--color-accent-hover': '#f0b868',
    '--color-accent-subtle': '#1c1420',
    '--color-bg-nav': '#141018',
    '--color-ring-focus': '#58b878',
    '--color-ring-offset': '#141018',
  },
  'pompeii-light': {
    '--color-bg-body': '#f2ede4',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#887868',
    '--color-text-primary': '#1a1210',
    '--color-text-secondary': '#6a5040',
    '--color-accent': '#983028',
    '--color-accent-hover': '#7c2820',
    '--color-accent-subtle': '#eae0d0',
    '--color-bg-nav': '#f2ede4',
    '--color-ring-focus': '#983028',
    '--color-ring-offset': '#ffffff',
  },
  'pompeii-dark': {
    '--color-bg-body': '#161210',
    '--color-bg-card': '#241e1a',
    '--color-border-card': '#786050',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#c8a888',
    '--color-accent': '#e08870',
    '--color-accent-hover': '#e8a090',
    '--color-accent-subtle': '#1e1810',
    '--color-bg-nav': '#161210',
    '--color-ring-focus': '#e08870',
    '--color-ring-offset': '#161210',
  },
  'nordic-light': {
    '--color-bg-body': '#f0f2f4',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#808890',
    '--color-text-primary': '#101418',
    '--color-text-secondary': '#506070',
    '--color-accent': '#385880',
    '--color-accent-hover': '#2c4868',
    '--color-accent-subtle': '#e4e8ec',
    '--color-bg-nav': '#f0f2f4',
    '--color-ring-focus': '#a83030',
    '--color-ring-offset': '#ffffff',
  },
  'nordic-dark': {
    '--color-bg-body': '#10141a',
    '--color-bg-card': '#1a2028',
    '--color-border-card': '#607080',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#a0b0c0',
    '--color-accent': '#88b0d0',
    '--color-accent-hover': '#a0c0e0',
    '--color-accent-subtle': '#141820',
    '--color-bg-nav': '#10141a',
    '--color-ring-focus': '#d86060',
    '--color-ring-offset': '#10141a',
  },
  'ottoman-light': {
    '--color-bg-body': '#f0ede8',
    '--color-bg-card': '#ffffff',
    '--color-border-card': '#707880',
    '--color-text-primary': '#181210',
    '--color-text-secondary': '#3a5858',
    '--color-accent': '#186858',
    '--color-accent-hover': '#105048',
    '--color-accent-subtle': '#e0e8e0',
    '--color-bg-nav': '#f0ede8',
    '--color-ring-focus': '#a87820',
    '--color-ring-offset': '#ffffff',
  },
  'ottoman-dark': {
    '--color-bg-body': '#0e1418',
    '--color-bg-card': '#182028',
    '--color-border-card': '#507870',
    '--color-text-primary': '#fafafa',
    '--color-text-secondary': '#c8b070',
    '--color-accent': '#d4a840',
    '--color-accent-hover': '#e0c060',
    '--color-accent-subtle': '#141c20',
    '--color-bg-nav': '#0e1418',
    '--color-ring-focus': '#58b8a0',
    '--color-ring-offset': '#0e1418',
  },
};

const PALETTE_LABELS: Record<ThemePalette, string> = {
  default: 'Default',
  rose: 'Ros\u00e9',
  rebecca: 'Rebecca Purple',
  lilac: 'Lilac',
  'morning-butter': 'Morning Butter',
  claude: 'Claude',
  'claude-v1': 'Claude v1',
  avocado: 'Avocado',
  marrakech: 'Moroccan',
  provencal: 'Proven\u00e7al',
  kaiseki: 'Kaiseki',
  tuscany: 'Tuscany',
  oaxacan: 'Oaxacan',
  pompeii: 'Pompeii',
  nordic: 'Nordic',
  ottoman: 'Ottoman',
};

const PALETTES: ThemePalette[] = ['default', 'rose', 'rebecca', 'lilac', 'morning-butter', 'claude', 'claude-v1', 'avocado',
  'marrakech', 'provencal', 'kaiseki', 'tuscany', 'oaxacan', 'pompeii', 'nordic', 'ottoman'];
const MODES: ('light' | 'dark')[] = ['light', 'dark'];

export default function AccessibilityPreferences() {
  const [overrides, setOverridesState] = useState<ColorOverrides>({});
  const [activePalette, setActivePalette] = useState<ThemePalette>('default');
  const [activeMode, setActiveMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    setOverridesState(getColorOverrides());
    setActivePalette(getThemePalette());
    setActiveMode(getCurrentMode());
  }, []);

  function handleChange(sectionKey: string, cssVar: CSSVar, value: string) {
    const next = { ...overrides };
    if (!next[sectionKey]) next[sectionKey] = {};
    next[sectionKey] = { ...next[sectionKey], [cssVar]: value };
    setOverridesState(next);
    setColorOverrides(next);
  }

  function handleResetSection(sectionKey: string) {
    const next = { ...overrides };
    delete next[sectionKey];
    setOverridesState(next);
    setColorOverrides(next);
  }

  function handleResetAll() {
    setOverridesState({});
    setColorOverrides({});
  }

  const activeKey = `${activePalette}-${activeMode}`;

  return (
    <div className="py-8">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <h1
          className="text-2xl sm:text-3xl font-bold mb-2"
        >
          Accessibility Preferences
        </h1>
        <p className="text-sm text-secondary mb-6">
          Override individual color tokens for any theme and mode. Changes are saved in your browser and apply immediately.
        </p>

        <button
          onClick={handleResetAll}
        className="mb-8 text-xs px-3 py-1.5 rounded border border-[var(--color-border-card)] hover:bg-[var(--color-accent-subtle)] transition-colors"
        style={{ cursor: 'pointer' }}
      >
        Reset All Overrides
      </button>
      </div>

      {PALETTES.map((palette) =>
        MODES.map((mode) => {
          const key = `${palette}-${mode}`;
          const defaults = DEFAULTS[key];
          const sectionOverrides = overrides[key] || {};
          const isActive = key === activeKey;
          const hasOverrides = Object.keys(sectionOverrides).length > 0;

          // Build inline styles so CSS variables resolve to this palette's colors
          const sectionStyles: Record<string, string> = {};
          for (const v of CSS_VARS) {
            sectionStyles[v] = sectionOverrides[v] || defaults[v];
          }

          const dataAttrs: Record<string, string> = {};
          if (palette !== 'default') dataAttrs['data-theme'] = palette;
          dataAttrs['data-color-scheme'] = mode;

          // Shorthand helpers for this section's resolved colors
          const s = {
            bg: sectionStyles['--color-bg-body'],
            card: sectionStyles['--color-bg-card'],
            border: sectionStyles['--color-border-card'],
            text: sectionStyles['--color-text-primary'],
            text2: sectionStyles['--color-text-secondary'],
            accent: sectionStyles['--color-accent'],
            accentSub: sectionStyles['--color-accent-subtle'],
            nav: sectionStyles['--color-bg-nav'],
          };

          return (
            <section
              key={key}
              id={`theme-${key}`}
              className="scroll-mt-20 py-8 px-4 sm:px-6"
              aria-label={`${PALETTE_LABELS[palette]} ${mode} theme`}
              data-theme={palette !== 'default' ? palette : undefined}
              data-color-scheme={mode}
              style={{ backgroundColor: s.bg, color: s.text }}
            >
              <div className="max-w-5xl mx-auto">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-semibold flex items-center gap-2 font-serif" style={{ color: s.text }}>
                  {PALETTE_LABELS[palette]} &mdash; {mode === 'light' ? 'Light' : 'Dark'}
                  {isActive && (
                    <span
                      className="text-xs font-normal px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: s.accentSub, color: s.text2 }}
                    >
                      Active
                    </span>
                  )}
                </h2>
                {hasOverrides && (
                  <button
                    onClick={() => handleResetSection(key)}
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{ borderColor: s.border, border: `1px solid ${s.border}`, color: s.text }}
                  >
                    Reset
                  </button>
                )}
              </div>

              <div className="overflow-x-auto rounded-lg" style={{ border: `1px solid ${s.border}` }}>
                <table className="w-full text-sm" style={{ backgroundColor: s.card, color: s.text }}>
                  <thead>
                    <tr style={{ borderBottom: `1px solid ${s.border}` }}>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: s.text2 }}>Token</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: s.text2 }}>Default</th>
                      <th className="text-left px-4 py-2 font-medium" style={{ color: s.text2 }}>Override</th>
                    </tr>
                  </thead>
                  <tbody>
                    {CSS_VARS.map((cssVar, i) => {
                      const defaultVal = defaults[cssVar];
                      const overrideVal = sectionOverrides[cssVar];
                      const isOverridden = overrideVal && overrideVal.toLowerCase() !== defaultVal.toLowerCase();
                      const isLast = i === CSS_VARS.length - 1;
                      const tokenId = `token-${key}-${cssVar}`;
                      return (
                        <tr
                          key={cssVar}
                          style={isLast ? undefined : { borderBottom: `1px solid ${s.border}` }}
                        >
                          <td className="px-4 py-2" style={{ color: s.text }}>
                            <div className="font-medium" id={tokenId}>{TOKEN_LABELS[cssVar]}</div>
                            <code className="text-xs opacity-70" style={{ color: s.text2 }}>{cssVar}</code>
                          </td>
                          <td className="px-4 py-2" style={{ color: s.text }}>
                            <div className="flex items-center gap-2">
                              <span
                                className="inline-block w-6 h-6 rounded shrink-0"
                                style={{ backgroundColor: defaultVal, border: `1px solid ${s.border}` }}
                              />
                              <code className="text-xs">{defaultVal}</code>
                            </div>
                          </td>
                          <td className="px-4 py-2" style={{ color: s.text }}>
                            <div className="flex items-center gap-2">
                              <input
                                type="color"
                                value={overrideVal || defaultVal}
                                onChange={(e) => handleChange(key, cssVar, e.target.value)}
                                className="w-8 h-8 rounded cursor-pointer bg-transparent p-0"
                                style={{ border: `1px solid ${s.border}` }}
                                aria-label={`Override color for ${PALETTE_LABELS[palette]} ${mode}`}
                                aria-describedby={tokenId}
                              />
                              {isOverridden && (
                                <code className="text-xs font-medium">{overrideVal}</code>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              </div>
            </section>
          );
        })
      )}
    </div>
  );
}
