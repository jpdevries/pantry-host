/**
 * Owner-gated write of Settings-page overrides.
 *
 * Does NOT touch .env.local at the monorepo root — Rex's V8 fs sandbox
 * forbids writes outside the project root (packages/app/). Instead, we
 * persist user-writable overrides to a JSON file at
 * `packages/app/.settings-overrides.json`. On the read side,
 * settings-read.ts merges this file on top of process.env so overrides
 * take effect immediately (no server restart needed).
 *
 * .env.local remains the authoritative home for secrets the user edits
 * by hand (DATABASE_URL, AI_API_KEY, etc). Settings-page edits are a
 * separate surface that layers on top.
 */
import type { NextApiRequest, NextApiResponse } from 'next';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';

// Keep in sync with packages/shared/src/settings-schema.ts.
const APP_KEYS = new Set([
  'RECIPE_API_KEY',
  'SHOW_COCKTAILDB',
  'PIXABAY_API_KEY',
  'PIXABAY_FALLBACK_ENABLED',
  'HARVEST_LOCATIONS',
]);
function isAllowedSettingKey(key: string): boolean {
  return APP_KEYS.has(key);
}

function isLocalhostRequest(req: NextApiRequest): boolean {
  const host = (req.headers.host ?? '').toLowerCase();
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const isLoopbackHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const proto = (req.headers['x-forwarded-proto'] as string) ?? '';
  const isHttps = proto === 'https';
  return isLoopbackHost || isHttps;
}

export const OVERRIDES_PATH = join(process.cwd(), '.settings-overrides.json');

export function readOverrides(): Record<string, string> {
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
    return {};
  } catch {
    return {};
  }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isLocalhostRequest(req)) {
    return res.status(403).json({ error: 'Not available to guests' });
  }

  const body = req.body as { values?: Record<string, string | null> } | undefined;
  const incoming = body?.values;
  if (!incoming || typeof incoming !== 'object') {
    return res.status(400).json({ error: 'Missing values' });
  }

  const current = readOverrides();

  for (const [key, value] of Object.entries(incoming)) {
    if (!isAllowedSettingKey(key)) {
      return res.status(400).json({ error: `Unknown or forbidden setting key: ${key}` });
    }
    if (value === null || value === '') {
      delete current[key];
    } else if (typeof value === 'string') {
      current[key] = value;
    } else {
      return res.status(400).json({ error: `Invalid value type for ${key}` });
    }
  }

  try {
    writeFileSync(OVERRIDES_PATH, JSON.stringify(current, null, 2) + '\n', 'utf-8');
  } catch (err) {
    return res.status(500).json({ error: `Write failed: ${(err as Error).message}` });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({ ok: true });
}
