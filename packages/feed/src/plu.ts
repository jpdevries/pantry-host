/**
 * PLU lookup — vendored mirror of `packages/shared/src/plu.ts`.
 *
 * **Source of truth lives in `packages/shared`.** Feed can't import
 * across package boundaries because its Dockerfile build context is
 * `packages/feed/` only (fly.io single-package build). Refreshing:
 * re-export the IFPS CSV (see the root plu.ts header), regenerate
 * `plu-codes.json` in shared, then `cp ../shared/src/plu-codes.json
 * src/plu-codes.json` inside this package. The TypeScript below is
 * a byte-identical subset — only the `buildPluMeta` ProductMeta
 * adapter is omitted because feed doesn't need it (the endpoint
 * returns raw candidates; ProductMeta construction happens on the
 * pantry-writing side).
 */

import pluData from './plu-codes.json';

export interface PluRecord {
  plu: string;
  category: string;
  commodity: string;
  variety?: string;
  size?: string;
  aka?: string;
  botanical?: string;
  type?: string;
}

export interface PluCandidate extends PluRecord {
  organic: boolean;
  confidence: 'exact' | 'partial';
}

const DATA: readonly PluRecord[] = pluData as readonly PluRecord[];

export function isPluCode(code: string): boolean {
  const clean = code.trim();
  if (!/^\d{4,5}$/.test(clean)) return false;
  if (clean.length === 4) {
    const n = Number(clean);
    return n >= 3000 && n <= 4999;
  }
  if (!clean.startsWith('9')) return false;
  const base = clean.slice(1);
  const n = Number(base);
  return n >= 3000 && n <= 4999;
}

const BY_CODE: Record<string, PluRecord> = (() => {
  const idx: Record<string, PluRecord> = {};
  for (const row of DATA) idx[row.plu] = row;
  return idx;
})();

export function lookupPluByCode(code: string): { record: PluRecord; organic: boolean } | null {
  const clean = code.trim();
  if (!isPluCode(clean)) return null;
  if (clean.length === 5 && clean.startsWith('9')) {
    const base = clean.slice(1);
    const rec = BY_CODE[base];
    return rec ? { record: rec, organic: true } : null;
  }
  const rec = BY_CODE[clean];
  return rec ? { record: rec, organic: false } : null;
}

function normalize(q: string): { text: string; organic: boolean } {
  const trimmed = q.trim().toLowerCase();
  const organic = /^organic\s+/.test(trimmed);
  let text = organic ? trimmed.replace(/^organic\s+/, '') : trimmed;
  text = text.replace(/\s+/g, ' ');
  text = text.replace(/(?<=\w)(ies|es|s)$/i, (m) => (m === 'ies' ? 'y' : ''));
  return { text, organic };
}

function scoreRecord(
  rec: PluRecord,
  q: string,
): { score: number; confidence: 'exact' | 'partial' } | null {
  const commodity = rec.commodity.toLowerCase();
  const variety = rec.variety?.toLowerCase() ?? '';
  const aka = rec.aka?.toLowerCase() ?? '';
  const botanical = rec.botanical?.toLowerCase() ?? '';
  const commoditySingular = commodity.replace(/(?<=\w)(ies|es|s)$/i, (m) =>
    m === 'ies' ? 'y' : '',
  );
  if (q === commodity || q === commoditySingular) {
    return { score: 100, confidence: 'exact' };
  }
  if (commodity.includes(q) || q.includes(commoditySingular)) {
    return { score: 80 - Math.min(commodity.length, 30), confidence: 'partial' };
  }
  if (variety && (variety.includes(q) || q.includes(variety))) {
    return { score: 60, confidence: 'partial' };
  }
  if (aka && aka.toLowerCase().includes(q)) {
    return { score: 50, confidence: 'partial' };
  }
  if (botanical && botanical.includes(q)) {
    return { score: 30, confidence: 'partial' };
  }
  return null;
}

function sizeBias(size: string | undefined): number {
  if (!size) return 5;
  const s = size.toLowerCase();
  if (s === 'all sizes' || s === '') return 5;
  return 0;
}

function varietyBias(rec: PluRecord): number {
  let bonus = 0;
  if (!rec.variety) bonus += 8;
  else {
    const v = rec.variety.toLowerCase();
    if (v.includes('includes ') || v === 'all varieties' || v === 'other') bonus += 10;
  }
  const plu = Number(rec.plu);
  if (plu >= 4000 && plu <= 4299) bonus += 3;
  return bonus;
}

export function lookupPluByName(name: string): PluCandidate[] {
  const norm = normalize(name);
  if (!norm.text) return [];
  const hits: Array<{ rec: PluRecord; score: number; confidence: 'exact' | 'partial' }> = [];
  for (const rec of DATA) {
    const s = scoreRecord(rec, norm.text);
    if (!s) continue;
    hits.push({
      rec,
      score: s.score + sizeBias(rec.size) + varietyBias(rec),
      confidence: s.confidence,
    });
  }
  hits.sort((a, b) => b.score - a.score);
  const capped = hits.slice(0, 20);
  return capped.map((h) => ({
    ...h.rec,
    plu: norm.organic ? `9${h.rec.plu}` : h.rec.plu,
    organic: norm.organic,
    confidence: h.confidence,
  }));
}

export function lookupPlusByNames(names: readonly string[]): Record<string, PluCandidate[]> {
  const out: Record<string, PluCandidate[]> = {};
  for (const n of names) out[n] = lookupPluByName(n);
  return out;
}
