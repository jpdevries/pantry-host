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

export type SettingKey =
  | 'RECIPE_API_KEY'
  | 'SHOW_COCKTAILDB'
  | 'PIXABAY_API_KEY'
  | 'PIXABAY_FALLBACK_ENABLED'
  | 'HARVEST_LOCATIONS'
  | 'STORE_BARCODE_META';

export type SettingKind = 'text' | 'secret' | 'boolean' | 'enum';

/** Optional grouping marker — consecutive entries sharing the same
 *  group.id render inside a single <fieldset><legend>. */
export interface SettingGroup {
  id: string;
  legend: string;
}

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
  /** HTML pattern attribute for native browser validation. */
  pattern?: string;
  /** Title shown when pattern validation fails. */
  patternTitle?: string;
  /** Optional "Get a key" style external link under the field. */
  externalLinkHref?: string;
  externalLinkLabel?: string;
  /** Which packages actually honor the setting. */
  packages: Array<'app' | 'web'>;
  /** Optional grouping for fieldset rendering. */
  group?: SettingGroup;
  /** Default value when no stored value exists. Booleans default to
   *  'true' if omitted (legacy behavior); set to 'false' for opt-in
   *  features that should start dormant. */
  defaultValue?: string;
}

const PIXABAY_GROUP: SettingGroup = {
  id: 'pixabay',
  legend: 'Pixabay fallback images',
};

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
  // Pixabay group — boolean first (primary control), key second
  // (prerequisite). Both render inside one <fieldset> on the Settings
  // page thanks to the shared `group` identifier.
  {
    key: 'PIXABAY_FALLBACK_ENABLED',
    label: 'Use Pixabay for missing recipe photos',
    description:
      'When on, recipes without their own photo will display a search result from Pixabay with courtesy photographer attribution. When off, those recipes render as compact text cards. Requires an API key.',
    kind: 'boolean',
    packages: ['app', 'web'],
    group: PIXABAY_GROUP,
    defaultValue: 'false',
  },
  {
    key: 'PIXABAY_API_KEY',
    label: 'Pixabay API key',
    description:
      'Pixabay images are free to use under the Pixabay Content License — attribution is optional but appreciated. The key is stored on your hardware and never proxied through any Pantry Host server. Rate limit: 100 requests/minute on the free tier.',
    kind: 'secret',
    placeholder: 'Your Pixabay API key',
    externalLinkHref: 'https://pixabay.com/api/docs/',
    externalLinkLabel: 'Get a key at pixabay.com/api/docs',
    packages: ['app', 'web'],
    group: PIXABAY_GROUP,
  },
  {
    key: 'SHOW_COCKTAILDB',
    label: 'Show TheCocktailDB import tab',
    description:
      "Defaults to on. Turn off to hide the alcoholic drink source on /recipes/import.",
    kind: 'boolean',
    packages: ['app', 'web'],
  },
  {
    key: 'STORE_BARCODE_META',
    label: 'Store barcode + product metadata',
    description:
      "Power user: when on, the batch scanner persists each item's barcode plus a allowlisted subset of Open Food Facts data (nutrition per 100g, ingredients text, allergens, Nutri-Score, NOVA group). Lets MCP agents and nutrition-aware tools reason about your pantry. Off by default; turning this on only affects new scans. Also toggleable from the scan modal header.",
    kind: 'boolean',
    packages: ['app', 'web'],
    defaultValue: 'false',
  },
  {
    key: 'HARVEST_LOCATIONS',
    label: 'Harvest Locations',
    description:
      'Comma-separated tag list of places you get ingredients — grocery stores, the farmers market, your garden. Tag individual ingredients with these names in the pantry, and the grocery list will group items by recipe by store.',
    kind: 'text',
    placeholder: 'farmers-market, garden, costco',
    pattern: '[a-z0-9\\-]+(, ?[a-z0-9\\-]+)*',
    patternTitle: 'Lowercase kebab-case tags separated by commas (e.g. farmers-market, garden)',
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
 * Allowlist check — used by the app's settings-read/write API routes
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
