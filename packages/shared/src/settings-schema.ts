/**
 * Central schema for the shared `/settings` page.
 *
 * Both packages (app + web) render the same form from this list. Each
 * package provides a SettingsAdapter that knows how to load/save values
 * against its own backing store (.env.local for app, localStorage for
 * web), but the labels, descriptions, input types, and ordering are
 * identical across packages so the user experience is consistent.
 *
 * Adding a new setting = one entry in SETTINGS_SCHEMA + any package
 * that actually reads the value needs to add it to its adapter's
 * read/write path. The shared component handles rendering.
 */

export type SettingKey = 'RECIPE_API_KEY' | 'SHOW_COCKTAILDB';

export type SettingKind = 'text' | 'secret' | 'boolean' | 'enum';

export interface SettingDef {
  /** Env-var-style uppercase key. Used as the storage key on both sides. */
  key: SettingKey;
  /** Human-friendly label shown above the input. */
  label: string;
  /** One- or two-sentence explanation rendered beneath the label. */
  description: string;
  /** Input type. `secret` is rendered as password with a Show toggle. */
  kind: SettingKind;
  /** Only used when kind === 'enum'. */
  enumValues?: string[];
  /** Shown as an input placeholder. */
  placeholder?: string;
  /** Optional "Get a key" style external link under the field. */
  externalLinkHref?: string;
  externalLinkLabel?: string;
  /** Which packages actually honor the setting. */
  packages: Array<'app' | 'web'>;
}

export const SETTINGS_SCHEMA: SettingDef[] = [
  {
    key: 'RECIPE_API_KEY',
    label: 'Recipe API key',
    description:
      'Unlocks the Recipe API import tab on /recipes/import with structured ingredients, USDA nutrition data, and dietary flags. A free tier exists (100 req/day).',
    kind: 'secret',
    placeholder: 'rapi_...',
    externalLinkHref: 'https://recipe-api.com/pricing',
    externalLinkLabel: 'Get a key at recipe-api.com/pricing',
    packages: ['app', 'web'],
  },
  {
    key: 'SHOW_COCKTAILDB',
    label: 'Show TheCocktailDB import tab',
    description:
      "Defaults to on. Turn off to hide the alcoholic drink source on /recipes/import. Strict households, kids' pantries, and faith-based deployments may prefer this off.",
    kind: 'boolean',
    packages: ['app', 'web'],
  },
];

/**
 * Helper: is this setting a secret that should be masked on the wire?
 */
export function isSecretSetting(key: SettingKey): boolean {
  return SETTINGS_SCHEMA.find((s) => s.key === key)?.kind === 'secret';
}

/**
 * Whitelist check — used by the app's settings-read/write API routes
 * to reject any key not on the schema. Prevents a misconfigured client
 * from reading or writing arbitrary env vars.
 */
export function isAllowedSettingKey(key: string): key is SettingKey {
  return SETTINGS_SCHEMA.some((s) => s.key === key);
}

/**
 * Mask the middle of a secret string for display. Leaves the first
 * `visibleStart` chars and last `visibleEnd` chars visible.
 *   "rapi_fae0fd66…441d2" → "rapi_fae0••••441d2"
 */
export function maskSecret(value: string, visibleStart = 8, visibleEnd = 5): string {
  if (!value) return '';
  if (value.length <= visibleStart + visibleEnd + 2) return value;
  return `${value.slice(0, visibleStart)}${'•'.repeat(8)}${value.slice(-visibleEnd)}`;
}
