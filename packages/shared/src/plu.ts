/**
 * Produce PLU (Price Look-Up) code lookups.
 *
 * Backed by the IFPS canonical dataset (`plu-codes.json`, ~1,500
 * approved 4-digit codes as shipped by
 * https://ifpsglobal.com/plu-codes-search). Conventional codes are
 * 4 digits in the range 3000–4999; the organic variant of a code
 * is the same 4-digit value prefixed with `9` (e.g. `4011` ->
 * `94011` for organic banana). The organic prefix isn't stored in
 * the dataset — we synthesize it at lookup time.
 *
 * Design notes:
 *   - Pure data + pure functions. No React, no I/O. Importable
 *     from Node (feed server), the Rex app API route, the web PWA,
 *     and any future MCP surface.
 *   - Matching is deliberately simple — lowercase normalize,
 *     strip plural "s", score against commodity/variety/aka/
 *     botanical fields, cap at 20 candidates. No Levenshtein, no
 *     ML. Transparent and debuggable.
 *   - Results carry a `confidence` hint (`exact` vs `partial`) so
 *     callers can decide whether to auto-apply vs surface for user
 *     confirmation.
 */

import pluData from './plu-codes.json';
import type { ProductMeta } from './product-meta';

// ── Types ────────────────────────────────────────────────────────────────

export interface PluRecord {
  /** The 4-digit (conventional) or 5-digit (organic variant) PLU. */
  plu: string;
  /** High-level produce bucket — "Fruits", "Vegetables", "Herbs",
   *  "Nuts", "Dried Fruits", or "Retailer Assigned Numbers". */
  category: string;
  /** Common name ("Bananas", "Apples"). Title-case. */
  commodity: string;
  /** Specific cultivar/variety ("Yellow (includes Cavendish)",
   *  "Hass"). Absent when the PLU covers the whole commodity. */
  variety?: string;
  /** "All Sizes", "Small", "Medium", "Large", "Extra Large", or
   *  a descriptor like "55 size and larger". */
  size?: string;
  /** Alternate / vernacular names sometimes populated by IFPS for
   *  searchability (e.g. "Alligator pear" for Avocado). */
  aka?: string;
  /** Scientific name (e.g. "Musa spp." for bananas). */
  botanical?: string;
  /** "Retailer Assigned Numbers" or absent (= "Global"). */
  type?: string;
}

export interface PluCandidate extends PluRecord {
  /** True when the caller asked for the organic variant (e.g. by
   *  prepending "organic " to their query). The `plu` field on the
   *  candidate is then the 5-digit `9XXXX` form. */
  organic: boolean;
  /** "exact" when the query matches commodity exactly; "partial"
   *  when it was a substring or aka/variety hit. */
  confidence: 'exact' | 'partial';
}

// ── Type of the JSON file ────────────────────────────────────────────────

const DATA: readonly PluRecord[] = pluData as readonly PluRecord[];

// ── Core detection ───────────────────────────────────────────────────────

/**
 * True when `code` could be a PLU rather than a UPC/EAN barcode.
 * Accepts 4-digit (conventional) and 5-digit-starting-with-9
 * (organic) numeric strings in the IFPS range. Intentionally
 * generous — the range check catches most typos without requiring
 * a full registry hit, which keeps this usable at input-time
 * before the lookup runs.
 */
export function isPluCode(code: string): boolean {
  const clean = code.trim();
  if (!/^\d{4,5}$/.test(clean)) return false;
  if (clean.length === 4) {
    const n = Number(clean);
    return n >= 3000 && n <= 4999;
  }
  // 5 digits: organic prefix `9` followed by a conventional base.
  if (!clean.startsWith('9')) return false;
  const base = clean.slice(1);
  const n = Number(base);
  return n >= 3000 && n <= 4999;
}

// ── Code → record ────────────────────────────────────────────────────────

/** Index by PLU string, built once at module init. */
const BY_CODE: Record<string, PluRecord> = (() => {
  const idx: Record<string, PluRecord> = {};
  for (const row of DATA) idx[row.plu] = row;
  return idx;
})();

/**
 * Look up a PLU record by numeric code. Accepts either the 4-digit
 * conventional form or the 5-digit organic form — the returned
 * record is always the 4-digit base, with `organic: true` when the
 * caller passed the `9` prefix.
 */
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

// ── Name → records ───────────────────────────────────────────────────────

/**
 * Normalize a query string for matching. Lower-case, collapse
 * whitespace, strip the "organic " prefix (returned separately so
 * the caller can up-rank 9XXXX forms), drop trailing plural `s`
 * from the last word (banana/bananas collapse).
 */
function normalize(q: string): { text: string; organic: boolean } {
  const trimmed = q.trim().toLowerCase();
  const organic = /^organic\s+/.test(trimmed);
  let text = organic ? trimmed.replace(/^organic\s+/, '') : trimmed;
  text = text.replace(/\s+/g, ' ');
  // Naive stem: drop trailing 's' or 'es' on the final word so
  // "bananas" matches "Bananas" and "tomatoes" matches "Tomatoes".
  // Over-eager by design — the cost of a false positive is tiny
  // because we're ranking, not filtering.
  text = text.replace(/(?<=\w)(ies|es|s)$/i, (m) =>
    m === 'ies' ? 'y' : '',
  );
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

  // Tier 1: exact commodity match (after normalization, we also
  // naive-stemmed the query so "banana" matches "bananas").
  // Compare the query to the commodity's singular form too.
  const commoditySingular = commodity.replace(/(?<=\w)(ies|es|s)$/i, (m) =>
    m === 'ies' ? 'y' : '',
  );
  if (q === commodity || q === commoditySingular) {
    return { score: 100, confidence: 'exact' };
  }
  // Tier 2: commodity contains the query (or vice versa).
  if (commodity.includes(q) || q.includes(commoditySingular)) {
    // Prefer shorter commodity names — "kiwi" matches "Kiwifruit"
    // and "Kiwifruit, other cultivars" — we want the shorter one
    // first.
    return { score: 80 - Math.min(commodity.length, 30), confidence: 'partial' };
  }
  // Tier 3: variety match.
  if (variety && (variety.includes(q) || q.includes(variety))) {
    return { score: 60, confidence: 'partial' };
  }
  // Tier 4: aka alternate-name match.
  if (aka && aka.toLowerCase().includes(q)) {
    return { score: 50, confidence: 'partial' };
  }
  // Tier 5: botanical (last-resort — "malus domestica" etc.).
  if (botanical && botanical.includes(q)) {
    return { score: 30, confidence: 'partial' };
  }
  return null;
}

function sizeBias(size: string | undefined): number {
  // Prefer "All Sizes" over specific size constraints when the
  // query didn't specify — a casual "apple" search should surface
  // the generic entry before the size-specific ones.
  if (!size) return 5;
  const s = size.toLowerCase();
  if (s === 'all sizes' || s === '') return 5;
  return 0;
}

/**
 * Bias toward "generic" / catchall varieties. IFPS marks the
 * default cultivar for a commodity with phrasing like "Yellow
 * (includes Cavendish)" or "All Varieties" — those should
 * outrank specific cultivars for a bare commodity query. Also
 * boosts the classic 4000–4299 PLU block where the most
 * commonly-used produce codes live (bananas 4011, avocados 4046,
 * apples 4129-ish, lemons 4053, etc.).
 */
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

/**
 * Look up PLU candidates by human name. Returns up to 20 records
 * ranked by confidence + ergonomic tie-breakers (prefer generic
 * entries over size-specific, shorter commodities, etc.). When
 * the query begins with "organic", each returned candidate's
 * `plu` is the 5-digit `9XXXX` form and `organic` is true.
 */
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

/**
 * Batch wrapper — one query in, one array of candidates out, keyed
 * by the original query string (so the caller can correlate).
 */
export function lookupPlusByNames(names: readonly string[]): Record<string, PluCandidate[]> {
  const out: Record<string, PluCandidate[]> = {};
  for (const n of names) out[n] = lookupPluByName(n);
  return out;
}

// ── ProductMeta adapter ──────────────────────────────────────────────────

/**
 * Build a `ProductMeta` payload from a PLU record. Sets
 * `plu_source: 'ifps'` so callers that introspect metadata can
 * branch on provenance (OFF vs IFPS).
 */
export function buildPluMeta(rec: PluRecord, organic = false): ProductMeta {
  const meta: ProductMeta = {
    code: organic ? `9${rec.plu}` : rec.plu,
    plu_source: 'ifps',
    commodity: rec.commodity,
    category: rec.category,
  };
  if (rec.variety) meta.variety = rec.variety;
  if (rec.size) meta.size = rec.size;
  if (organic) meta.organic = true;
  return meta;
}
