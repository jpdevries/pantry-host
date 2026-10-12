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
import { isOwnerRequest } from '@pantry-host/shared/owner-request';
import { readFileSync, existsSync, writeFileSync } from 'fs';
import { join } from 'path';
import { parse as parseQS } from 'querystring';

import { SETTINGS_SCHEMA, isAllowedSettingKey } from '@pantry-host/shared/settings-schema';

// Boolean setting keys — needed to handle unchecked checkboxes in form POSTs.
const BOOLEAN_KEYS = new Set(
  SETTINGS_SCHEMA.filter((s) => s.kind === 'boolean' && s.packages.includes('app')).map((s) => s.key),
);

/** Sentinel value: the form sends this for masked secrets the user didn't edit. */
const UNCHANGED_SENTINEL = '__UNCHANGED__';

function isLocalhostRequest(req: NextApiRequest): boolean {
  return isOwnerRequest(req.headers);
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

/** Read the raw request body when Rex/Next hasn't parsed it. */
function readRawBody(req: NextApiRequest): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
    req.on('error', reject);
  });
}

/**
 * Parse incoming values from either JSON (`{ values: {...} }`) or
 * form-encoded flat key-value pairs. Returns null on bad input.
 */
async function parseIncoming(req: NextApiRequest): Promise<Record<string, string | null> | null> {
  const ct = (req.headers['content-type'] ?? '').toLowerCase();
  if (ct.includes('application/json')) {
    const body = req.body as { values?: Record<string, string | null> } | undefined;
    return body?.values && typeof body.values === 'object' ? body.values : null;
  }
  // Form-encoded: req.body may be pre-parsed, a raw string, or absent.
  let flat: Record<string, string> | undefined;
  if (req.body && typeof req.body === 'object') {
    flat = req.body as Record<string, string>;
  } else {
    const raw = typeof req.body === 'string' ? req.body : await readRawBody(req);
    if (raw) flat = parseQS(raw) as Record<string, string>;
  }
  if (!flat || typeof flat !== 'object') return null;
  const out: Record<string, string | null> = {};
  for (const [key, value] of Object.entries(flat)) {
    if (!isAllowedSettingKey(key)) continue; // ignore extra form fields
    if (value === UNCHANGED_SENTINEL) continue; // skip unchanged secrets
    out[key] = value === '' ? null : value;
  }
  // Unchecked checkboxes are absent from form data — treat as 'false'.
  for (const bk of BOOLEAN_KEYS) {
    if (!(bk in flat)) out[bk] = 'false';
  }
  return Object.keys(out).length > 0 ? out : null;
}

function isFormPost(req: NextApiRequest): boolean {
  const ct = (req.headers['content-type'] ?? '').toLowerCase();
  return ct.includes('application/x-www-form-urlencoded');
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!isLocalhostRequest(req)) {
    return res.status(403).json({ error: 'Not available to guests' });
  }

  const incoming = await parseIncoming(req);
  if (!incoming) {
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

  // Form POST → redirect back to settings with flash. JSON → return JSON.
  if (isFormPost(req)) {
    res.setHeader('Location', '/settings');
    return res.status(302).json({ ok: true });
  }

  res.setHeader('Cache-Control', 'private, no-store');
  return res.status(200).json({ ok: true });
}
