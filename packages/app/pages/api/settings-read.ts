/**
 * Owner-gated read of settings from process.env.
 *
 * Returns { locked: true, values: null } for guests (plain HTTP on a
 * LAN IP). Returns { locked: false, values: {...}, maskedKeys: [...] }
 * for owners (loopback host or HTTPS).
 *
 * Secret values are masked by default. The client can request the full
 * value for a single key by passing `?reveal=<KEY>`.
 *
 * **Reads only from process.env, never from disk.** Rex's V8 API
 * runtime can't bundle Node builtins like `fs` in API route handlers —
 * importing them makes the module fail to initialize. Env vars are
 * populated from `.env.local` at process startup via launch.json
 * (`set -a && source .env.local && set +a`), so the server process has
 * everything we need in memory.
 *
 * Consequence: changes made by settings-write.ts only take effect after
 * the user restarts graphql-server (and optionally the Rex dev server).
 * We surface this via `postSaveNotice` in the client adapter.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// Keep in sync with packages/shared/src/settings-schema.ts.
type SettingKey =
  | 'RECIPE_API_KEY'
  | 'SHOW_COCKTAILDB'
  | 'PIXABAY_API_KEY'
  | 'PIXABAY_FALLBACK_ENABLED';
const APP_KEYS: SettingKey[] = [
  'RECIPE_API_KEY',
  'SHOW_COCKTAILDB',
  'PIXABAY_API_KEY',
  'PIXABAY_FALLBACK_ENABLED',
];
const SECRET_KEYS = new Set<SettingKey>(['RECIPE_API_KEY', 'PIXABAY_API_KEY']);

function isAllowedSettingKey(key: string): key is SettingKey {
  return (APP_KEYS as string[]).includes(key);
}
function isSecretSetting(key: SettingKey): boolean {
  return SECRET_KEYS.has(key);
}
function maskSecret(value: string, visibleStart = 8, visibleEnd = 5): string {
  if (!value) return '';
  if (value.length <= visibleStart + visibleEnd + 2) return value;
  return `${value.slice(0, visibleStart)}${'•'.repeat(8)}${value.slice(-visibleEnd)}`;
}

// Overrides written by /api/settings-write.ts. Layered on top of
// process.env so changes from the Settings page take effect immediately
// without a server restart.
const OVERRIDES_PATH = join(process.cwd(), '.settings-overrides.json');
function readOverrides(): Record<string, string> {
  if (!existsSync(OVERRIDES_PATH)) return {};
  try {
    const raw = readFileSync(OVERRIDES_PATH, 'utf-8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string') out[k] = v;
      }
      return out;
    }
  } catch { /* ignore corrupt file — treat as empty */ }
  return {};
}

function isLocalhostRequest(req: NextApiRequest): boolean {
  const host = (req.headers.host ?? '').toLowerCase();
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const isLoopbackHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const proto = (req.headers['x-forwarded-proto'] as string) ?? '';
  const isHttps = proto === 'https';
  return isLoopbackHost || isHttps;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Cache-Control', 'private, no-store');

  if (!isLocalhostRequest(req)) {
    return res.status(200).json({ locked: true, values: null });
  }

  // Rex's V8 API runtime only exposes process.env via literal-key
  // access. Must hardcode the lookup per known key.
  const envLiteral: Record<SettingKey, string | undefined> = {
    RECIPE_API_KEY: process.env.RECIPE_API_KEY,
    SHOW_COCKTAILDB: process.env.SHOW_COCKTAILDB,
    PIXABAY_API_KEY: process.env.PIXABAY_API_KEY,
    PIXABAY_FALLBACK_ENABLED: process.env.PIXABAY_FALLBACK_ENABLED,
  };
  // Overrides win over .env.local-derived process.env so user edits on
  // /settings take effect immediately without a restart.
  const overrides = readOverrides();
  const lookup = (key: SettingKey): string | null => overrides[key] ?? envLiteral[key] ?? null;

  // Single-key reveal mode: ?reveal=RECIPE_API_KEY returns just that key unmasked.
  const revealKey = (req.query.reveal as string | undefined) ?? null;
  if (revealKey) {
    if (!isAllowedSettingKey(revealKey)) {
      return res.status(400).json({ error: 'Unknown setting key' });
    }
    return res.status(200).json({ locked: false, key: revealKey, value: lookup(revealKey) });
  }

  const values: Record<string, string | null> = {};
  const maskedKeys: string[] = [];
  for (const key of APP_KEYS) {
    const raw = lookup(key);
    if (raw == null) {
      values[key] = null;
      continue;
    }
    if (isSecretSetting(key)) {
      values[key] = maskSecret(raw);
      maskedKeys.push(key);
    } else {
      values[key] = raw;
    }
  }

  return res.status(200).json({ locked: false, values, maskedKeys });
}
