/**
 * PLU lookup endpoint — self-hosted mirror of
 * feed.pantryhost.app/api/plu. Same URL path, same JSON shape, so
 * clients can swap base URLs without branching.
 *
 * Backed by the IFPS static dataset in `@pantry-host/shared/plu`.
 * Lookup is in-process, no network calls — data ships with the
 * app bundle.
 *
 *   GET /api/plu?name=banana
 *   GET /api/plu?name=banana,avocado,kiwi  ← batch (comma-delimited)
 *   GET /api/plu?code=4011                 ← reverse lookup
 *
 * Repeat-form (`?name=a&name=b`) is accepted too, but Rex's default
 * query parser collapses duplicates to last-wins — the comma form
 * is the canonical batch shape. Feed (Express) supports both
 * equally via its Express-native array parsing.
 *
 * Response shape (see `packages/shared/src/plu.ts` for types):
 *   name form:  { results: [{ query, candidates: [PluCandidate…] }] }
 *   code form:  { code, record, organic }
 */

import type { NextApiRequest, NextApiResponse } from 'next';
import { lookupPluByName, lookupPluByCode, isPluCode } from '@pantry-host/shared/plu';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  // Rex's default query parser collapses repeated `name=` params
  // to last-wins instead of an array. Fall back to parsing the raw
  // request URL via URLSearchParams.getAll to collect every value.
  // Matches feed.pantryhost.app/api/plu which gets array form for
  // free via Express. Both surfaces accept:
  //   ?name=a&name=b  (preferred, clean URLs)
  //   ?name=a,b,c     (fallback comma-delimited for awkward shells)
  const rawUrl = req.url ?? '';
  const qIndex = rawUrl.indexOf('?');
  const qs = qIndex >= 0 ? rawUrl.slice(qIndex + 1) : '';
  const params = new URLSearchParams(qs);
  const rawCode =
    params.get('code') ?? (typeof req.query.code === 'string' ? req.query.code : null);
  if (rawCode) {
    if (!isPluCode(rawCode)) {
      return res.status(400).json({ error: 'code must be a 4- or 5-digit PLU' });
    }
    const hit = lookupPluByCode(rawCode);
    // IFPS data refreshes annually at most — a day of cache is fine.
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.json({
      code: rawCode,
      record: hit?.record ?? null,
      organic: hit?.organic ?? false,
    });
  }

  // getAll returns [] if no name= at all; if the raw parse gave
  // us nothing, fall back to req.query.name so last-wins still
  // works for the single-name case.
  const collected = params.getAll('name');
  const fallback = Array.isArray(req.query.name)
    ? req.query.name.filter((n): n is string => typeof n === 'string')
    : typeof req.query.name === 'string'
      ? [req.query.name]
      : [];
  const source = collected.length ? collected : fallback;
  const names = source
    .flatMap((v) => v.split(','))
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
  if (!names.length) {
    return res.status(400).json({ error: 'name or code query param required' });
  }
  const results = names.map((query) => ({ query, candidates: lookupPluByName(query) }));
  res.setHeader('Cache-Control', 'public, max-age=86400');
  return res.json({ results });
}
