/**
 * Pantry review: turn a pantry list into things worth a look.
 *
 * Pure functions, no I/O. Both UIs (the review page, badges on the pantry
 * list, the dashboard card) and the MCP `review_pantry` tool call
 * `reviewPantry` on the same GraphQL rows, so the signals can't drift
 * between tiers. Nothing here writes; the actions (touch, update, merge,
 * delete) are the Phase 1 mutations.
 *
 * Expiry is stated or estimated, never stored as an estimate:
 *   - `expiresAt` is a date someone stated. When set, it wins.
 *   - Otherwise the estimate is `stockedAt + shelfLife(row)`, derived here
 *     at read time, so a better shelf-life table or a restock changes the
 *     answer without a migration. Every finding says which it was.
 *
 * `shelfLife` is honest about its confidence: a category-level number
 * ignores whether the carton is open, so findings read as questions
 * ("still good?") in the UI, and `alwaysOnHand` rows are exempt from
 * everything.
 *
 * Design: docs/pantry-review.md.
 */

import { normalizeIngredientName } from './grocery-status';
import { convert, normalizeUnit } from './units';
import { safeParseMeta } from './product-meta';

// ── Row shape ───────────────────────────────────────────────────────────────

/** The GraphQL `Ingredient` fields the review needs. */
export interface PantryRowForReview {
  id: string;
  name: string;
  aliases?: string[] | null;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
  itemSize?: number | null;
  itemSizeUnit?: string | null;
  alwaysOnHand: boolean;
  tags?: string[] | null;
  barcode?: string | null;
  /** JSON-encoded ProductMeta, as the API returns it. */
  productMeta?: string | null;
  /** Stated best-by date (ISO 8601) or null. */
  expiresAt?: string | null;
  /** When stock last came in. The API falls back to createdAt. */
  stockedAt: string;
  updatedAt?: string | null;
  createdAt?: string | null;
}

// ── Shelf life ──────────────────────────────────────────────────────────────

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Days from stock-in to "look at this", by pantry category. A first cut:
 * conservative for fresh food, generous for shelf-stable. `null` means the
 * category gives no basis for an estimate.
 */
export const CATEGORY_SHELF_LIFE_DAYS: Record<string, number | null> = {
  'seafood & fish': 2,
  'meat & poultry': 3,
  'fresh herbs': 5,
  'deli & charcuterie': 5,
  vegetables: 7,
  fruit: 7,
  'tofu & tempeh': 7,
  'plant-based milks': 10,
  dairy: 14,
  eggs: 28,
  snacks: 90,
  'nuts & seeds': 180,
  'condiments & sauces': 180,
  frozen: 180,
  // Wine, spirits, coffee beans and sodas all outlast a season; fresh juice is
  // caught by the OFF `juice` rule when scanned.
  beverages: 365,
  'oils & vinegars': 365,
  'herbs & spices': 365,
  baking: 365,
  'dry goods & grains': 365,
  'legumes & pulses': 365,
  'canned & jarred': 730,
  other: null,
};

/** Shelf life when a row is tagged `frozen` whatever its category. */
export const FROZEN_SHELF_LIFE_DAYS = 180;

/** Days untouched before a row with no shelf-life basis is flagged stale. */
export const DEFAULT_STALE_DAYS = 180;

/**
 * Open Food Facts category refinements for scanned rows, matched as
 * substrings against `categories_tags`, `main_category` and
 * `pnns_groups_2` (lowercased). More specific than our 22 categories:
 * "en:uht-milks" is not "dairy, 14 days". First match wins, so order
 * specific before general.
 */
export const OFF_SHELF_LIFE_RULES: ReadonlyArray<{ match: string; days: number }> = [
  { match: 'uht', days: 180 },
  { match: 'canned', days: 730 },
  { match: 'preserve', days: 730 },
  { match: 'jams', days: 365 },
  { match: 'frozen', days: 180 },
  { match: 'dried', days: 365 },
  { match: 'dehydrated', days: 365 },
  { match: 'fresh-milk', days: 10 },
  { match: 'yogurt', days: 14 },
  { match: 'yoghurt', days: 14 },
  { match: 'cream-cheese', days: 14 },
  { match: 'cheese', days: 30 },
  { match: 'fresh-vegetable', days: 7 },
  { match: 'fresh-fruit', days: 7 },
  { match: 'bread', days: 5 },
  { match: 'pastr', days: 4 },
  { match: 'fresh-meat', days: 3 },
  { match: 'poultr', days: 3 },
  { match: 'fish', days: 2 },
  { match: 'seafood', days: 2 },
  { match: 'egg', days: 28 },
  { match: 'pasta', days: 730 },
  { match: 'rice', days: 730 },
  { match: 'cereal', days: 365 },
  { match: 'flour', days: 365 },
  { match: 'chocolate', days: 365 },
  { match: 'spice', days: 365 },
  { match: 'oil', days: 365 },
  { match: 'vinegar', days: 730 },
  { match: 'sauce', days: 180 },
  { match: 'condiment', days: 180 },
  { match: 'honey', days: 730 },
  { match: 'nut', days: 180 },
  { match: 'water', days: 365 },
  { match: 'soda', days: 365 },
  { match: 'juice', days: 10 },
];

export type ShelfLifeBasis =
  | { days: number; source: 'off'; tag: string }
  | { days: number; source: 'frozen-tag' }
  | { days: number; source: 'category'; category: string }
  | { days: null; source: 'none' };

/** Why we think a row lasts as long as we do. */
export function shelfLife(row: Pick<PantryRowForReview, 'category' | 'tags' | 'productMeta'>): ShelfLifeBasis {
  const meta = safeParseMeta(row.productMeta);
  if (meta && !meta.plu_source) {
    const tags = [
      ...(meta.categories_tags ?? []),
      ...(meta.main_category ? [meta.main_category] : []),
      ...(meta.pnns_groups_2 ? [meta.pnns_groups_2] : []),
    ].map((t) => t.toLowerCase());
    for (const rule of OFF_SHELF_LIFE_RULES) {
      const hit = tags.find((t) => t.includes(rule.match));
      if (hit) return { days: rule.days, source: 'off', tag: hit };
    }
  }
  if ((row.tags ?? []).some((t) => t.toLowerCase() === 'frozen')) {
    return { days: FROZEN_SHELF_LIFE_DAYS, source: 'frozen-tag' };
  }
  const category = (row.category ?? 'other').toLowerCase();
  const days = CATEGORY_SHELF_LIFE_DAYS[category];
  if (days == null) return { days: null, source: 'none' };
  return { days, source: 'category', category };
}

// ── Expiry ──────────────────────────────────────────────────────────────────

export type ExpiryProvenance = 'explicit' | 'estimated';

export interface ExpiryEstimate {
  /** ISO 8601 date-time. */
  date: string;
  provenance: ExpiryProvenance;
  basis: ShelfLifeBasis;
}

function parseDate(s: string | null | undefined): number | null {
  if (!s) return null;
  const t = new Date(s).getTime();
  return Number.isFinite(t) ? t : null;
}

/**
 * The best-by date for a row: the stated one if any, else stocked-in plus
 * shelf life. Null when neither exists (always on hand, or a category
 * without a shelf life and no stated date).
 */
export function estimatedExpiry(row: PantryRowForReview): ExpiryEstimate | null {
  const basis = shelfLife(row);
  if (row.expiresAt) {
    const t = parseDate(row.expiresAt);
    if (t != null) return { date: new Date(t).toISOString(), provenance: 'explicit', basis };
  }
  if (row.alwaysOnHand) return null;
  if (basis.days == null) return null;
  const stocked = parseDate(row.stockedAt) ?? parseDate(row.createdAt);
  if (stocked == null) return null;
  return { date: new Date(stocked + basis.days * DAY_MS).toISOString(), provenance: 'estimated', basis };
}

// ── Findings ────────────────────────────────────────────────────────────────

export type ReviewSignal = 'expired' | 'expiring' | 'stale' | 'duplicate' | 'outOfStock';

export const REVIEW_SIGNALS: readonly ReviewSignal[] = ['expired', 'expiring', 'stale', 'duplicate', 'outOfStock'];

/** Short labels for badges and section headings, in review order. */
export const REVIEW_SIGNAL_LABELS: Record<ReviewSignal, string> = {
  expired: 'Expired',
  expiring: 'Expiring soon',
  stale: 'Possibly stale',
  duplicate: 'Likely duplicates',
  outOfStock: 'Out of stock',
};

export interface ReviewFinding {
  signal: ReviewSignal;
  /** One row for every signal except `duplicate`, which groups rows. */
  ids: string[];
  /** Human reason, e.g. "estimated from dairy, stocked 19 days ago". */
  reason: string;
  /** For expired / expiring: how the date was arrived at. */
  provenance?: ExpiryProvenance;
  /** For expired / expiring: the date in question (ISO 8601). */
  date?: string;
  /** For duplicate: the row to keep. Most recently stocked wins, then the
   *  row with barcode metadata, then the one with more tags. */
  survivorId?: string;
  /** For duplicate: what tied the rows together. */
  matchedOn?: Array<'name' | 'alias' | 'barcode'>;
  /** For expired / expiring: how the shelf life was arrived at, so a UI can
   *  compose its own sentence from the structured fields instead of
   *  `reason`. */
  basis?: ShelfLifeBasis;
  /** For expired / expiring / stale / outOfStock: the ISO date the finding
   *  is anchored on — stocked-in for freshness signals, the last update
   *  for out-of-stock. */
  since?: string;
}

export interface ReviewOptions {
  /** Defaults to Date.now(). */
  now?: number | Date;
  /** "Expiring soon" horizon. Default 3. */
  expiringWithinDays?: number;
  /** Days untouched before a row with no shelf-life basis counts as stale. Default 180. */
  staleDays?: number;
  /** Days at quantity 0 before a row is flagged. Default 14. */
  outOfStockDays?: number;
  /** Signals to compute. Default: all. */
  signals?: readonly ReviewSignal[];
}

export interface ReviewResult {
  findings: ReviewFinding[];
  /** Counts per signal, zero-filled, for badges and the dashboard card. */
  counts: Record<ReviewSignal, number>;
  /** Rows flagged by anything, deduplicated. */
  flaggedIds: string[];
}

function daysAgo(ms: number, now: number): number {
  return Math.floor((now - ms) / DAY_MS);
}

/** "estimated from dairy", "estimated for frozen food", … */
export function describeBasis(basis: ShelfLifeBasis): string {
  switch (basis.source) {
    case 'off':
      return `estimated from its product category (${basis.tag.replace(/^en:/, '')})`;
    case 'frozen-tag':
      return 'estimated for frozen food';
    case 'category':
      return `estimated from ${basis.category}`;
    default:
      return 'no estimate';
  }
}

function stockedPhrase(row: PantryRowForReview, now: number): string {
  const t = parseDate(row.stockedAt) ?? parseDate(row.createdAt);
  if (t == null) return '';
  const d = daysAgo(t, now);
  if (d <= 0) return ', stocked today';
  if (d === 1) return ', stocked yesterday';
  return `, stocked ${d} days ago`;
}

function fmtDays(n: number): string {
  return n === 1 ? '1 day' : `${n} days`;
}

/** Review a kitchen's pantry. Rows should all belong to one kitchen. */
export function reviewPantry(rows: PantryRowForReview[], options: ReviewOptions = {}): ReviewResult {
  const now = options.now instanceof Date ? options.now.getTime() : (options.now ?? Date.now());
  const expiringWithin = (options.expiringWithinDays ?? 3) * DAY_MS;
  const staleDays = options.staleDays ?? DEFAULT_STALE_DAYS;
  const outOfStockMs = (options.outOfStockDays ?? 14) * DAY_MS;
  const wanted = new Set<ReviewSignal>(options.signals ?? REVIEW_SIGNALS);

  const findings: ReviewFinding[] = [];

  // One freshness signal per row, by priority: out of stock, expired,
  // expiring, stale. Duplicates are orthogonal and can overlap.
  for (const row of rows) {
    if (row.alwaysOnHand) continue;

    if (row.quantity === 0) {
      if (!wanted.has('outOfStock')) continue;
      const since = parseDate(row.updatedAt) ?? parseDate(row.stockedAt);
      if (since != null && now - since >= outOfStockMs) {
        findings.push({
          signal: 'outOfStock',
          ids: [row.id],
          reason: `out of stock for ${fmtDays(daysAgo(since, now))}`,
          since: new Date(since).toISOString(),
        });
      }
      continue;
    }

    const expiry = estimatedExpiry(row);
    if (expiry) {
      const t = new Date(expiry.date).getTime();
      const how = expiry.provenance === 'explicit' ? 'stated' : describeBasis(expiry.basis);
      if (t < now) {
        if (wanted.has('expired')) {
          findings.push({
            signal: 'expired',
            ids: [row.id],
            reason: `${expiry.provenance === 'explicit' ? 'best-by' : 'estimated best-by'} passed ${fmtDays(daysAgo(t, now))} ago (${how}${stockedPhrase(row, now)})`,
            provenance: expiry.provenance,
            date: expiry.date,
            basis: expiry.basis,
            since: row.stockedAt,
          });
        }
        continue;
      }
      if (t - now <= expiringWithin) {
        if (wanted.has('expiring')) {
          const left = Math.ceil((t - now) / DAY_MS);
          findings.push({
            signal: 'expiring',
            ids: [row.id],
            reason: `${left <= 0 ? 'best-by is today' : `${fmtDays(left)} left`} (${how}${stockedPhrase(row, now)})`,
            provenance: expiry.provenance,
            date: expiry.date,
            basis: expiry.basis,
            since: row.stockedAt,
          });
        }
        continue;
      }
    }

    if (!wanted.has('stale')) continue;
    // Stale is the "is this still here?" nudge for rows nothing else can
    // speak to: no stated date and no shelf-life basis. Rows with a basis
    // are covered by expired/expiring above (a row past its shelf life is
    // reported as past its estimated best-by, not as stale), and a stated
    // date, past or future, is the user telling us what they know.
    if (expiry) continue;
    const anchor = parseDate(row.stockedAt) ?? parseDate(row.createdAt);
    if (anchor != null && now - anchor >= staleDays * DAY_MS) {
      findings.push({
        signal: 'stale',
        ids: [row.id],
        reason: `untouched for ${fmtDays(daysAgo(anchor, now))} and no shelf-life estimate for ${row.category ?? 'uncategorised'} items`,
        since: new Date(anchor).toISOString(),
      });
    }
  }

  if (wanted.has('duplicate')) findings.push(...findDuplicates(rows));

  const counts = Object.fromEntries(REVIEW_SIGNALS.map((s) => [s, 0])) as Record<ReviewSignal, number>;
  const flagged = new Set<string>();
  for (const f of findings) {
    counts[f.signal] += 1;
    for (const id of f.ids) flagged.add(id);
  }
  return { findings, counts, flaggedIds: [...flagged] };
}

// ── Duplicates ──────────────────────────────────────────────────────────────

/**
 * Group rows that answer to the same thing: same normalized name, a name
 * that is another row's alias, or the same barcode. Union-find over those
 * keys so A~B and B~C land in one group.
 */
export function findDuplicates(rows: PantryRowForReview[]): ReviewFinding[] {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let r = x;
    while (parent.get(r) !== r) r = parent.get(r)!;
    // path compression
    let c = x;
    while (parent.get(c) !== r) { const n = parent.get(c)!; parent.set(c, r); c = n; }
    return r;
  };
  const union = (a: string, b: string) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); };
  for (const r of rows) parent.set(r.id, r.id);

  const matchedOn = new Map<string, Set<'name' | 'alias' | 'barcode'>>();
  const note = (a: string, b: string, how: 'name' | 'alias' | 'barcode') => {
    for (const id of [a, b]) {
      if (!matchedOn.has(id)) matchedOn.set(id, new Set());
      matchedOn.get(id)!.add(how);
    }
    union(a, b);
  };

  // key → first row id seen with that key, per key kind
  const byName = new Map<string, string>();
  const byBarcode = new Map<string, string>();
  for (const r of rows) {
    const n = normalizeIngredientName(r.name);
    if (n) {
      const prev = byName.get(n);
      if (prev && prev !== r.id) note(prev, r.id, 'name');
      else byName.set(n, r.id);
    }
    if (r.barcode) {
      const prev = byBarcode.get(r.barcode);
      if (prev && prev !== r.id) note(prev, r.id, 'barcode');
      else byBarcode.set(r.barcode, r.id);
    }
  }
  // Aliases: a row whose alias normalizes to another row's name (or alias).
  const aliasOwners = new Map<string, string>();
  for (const r of rows) {
    for (const a of r.aliases ?? []) {
      const n = normalizeIngredientName(a);
      if (!n) continue;
      const nameOwner = byName.get(n);
      if (nameOwner && nameOwner !== r.id) note(nameOwner, r.id, 'alias');
      const prev = aliasOwners.get(n);
      if (prev && prev !== r.id) note(prev, r.id, 'alias');
      else aliasOwners.set(n, r.id);
    }
  }

  const groups = new Map<string, PantryRowForReview[]>();
  for (const r of rows) {
    const root = find(r.id);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(r);
  }

  const out: ReviewFinding[] = [];
  for (const members of groups.values()) {
    if (members.length < 2) continue;
    const survivor = pickSurvivor(members);
    const hows = new Set<'name' | 'alias' | 'barcode'>();
    for (const m of members) for (const h of matchedOn.get(m.id) ?? []) hows.add(h);
    const names = members.map((m) => `"${m.name}"`).join(', ');
    out.push({
      signal: 'duplicate',
      ids: members.map((m) => m.id),
      survivorId: survivor.id,
      matchedOn: [...hows],
      reason: `${names} look like the same item (${[...hows].map((h) => ({ name: 'same name', alias: 'alias overlap', barcode: 'same barcode' })[h]).join(', ')})`,
    });
  }
  return out;
}

/** Most recently stocked; ties go to barcode metadata, then more tags. */
export function pickSurvivor(members: PantryRowForReview[]): PantryRowForReview {
  return [...members].sort((a, b) => {
    const sa = parseDate(a.stockedAt) ?? 0;
    const sb = parseDate(b.stockedAt) ?? 0;
    if (sb !== sa) return sb - sa;
    const ma = a.barcode || a.productMeta ? 1 : 0;
    const mb = b.barcode || b.productMeta ? 1 : 0;
    if (mb !== ma) return mb - ma;
    return (b.tags?.length ?? 0) - (a.tags?.length ?? 0);
  })[0];
}

// ── Merge preview ───────────────────────────────────────────────────────────

export interface MergePlan {
  quantity: number | null;
  unit: string | null;
  category: string | null;
  tags: string[];
  aliases: string[];
  barcode: string | null;
  productMeta: string | null;
  expiresAt: string | null;
  stockedAt: string;
  /** Names whose quantity can't be added (incompatible units or item sizes). */
  unmergedQuantities: string[];
}

/**
 * What `mergeIngredients(survivorId, others)` will produce. Mirrors the
 * server resolver so the review page can show the outcome before
 * committing; the server stays authoritative.
 */
export function planMerge(survivor: PantryRowForReview, others: PantryRowForReview[]): MergePlan {
  const lower = (s: string) => s.toLowerCase();
  let quantity = survivor.quantity ?? null;
  const unmerged: string[] = [];
  const tags = [...(survivor.tags ?? [])];
  const aliases = [...(survivor.aliases ?? [])];
  const seenTags = new Set(tags.map(lower));
  const seenAliases = new Set([lower(survivor.name), ...aliases.map(lower)]);
  let barcode = survivor.barcode ?? null;
  let productMeta = survivor.productMeta ?? null;
  let category = survivor.category ?? null;
  let expiresAt = survivor.expiresAt ?? null;
  let stockedAt = survivor.stockedAt;

  for (const o of others) {
    if (o.id === survivor.id) continue;
    if (!survivor.alwaysOnHand && o.quantity != null) {
      const sameSize =
        (survivor.itemSize ?? null) === (o.itemSize ?? null) &&
        normalizeUnit(survivor.itemSizeUnit) === normalizeUnit(o.itemSizeUnit);
      const add = !survivor.unit && !o.unit ? o.quantity : convert(o.quantity, o.unit, survivor.unit);
      if (sameSize && add != null) quantity = (quantity ?? 0) + add;
      else unmerged.push(o.name);
    }
    for (const tag of o.tags ?? []) {
      if (!seenTags.has(lower(tag))) { seenTags.add(lower(tag)); tags.push(tag); }
    }
    for (const alias of [o.name, ...(o.aliases ?? [])]) {
      if (!seenAliases.has(lower(alias))) { seenAliases.add(lower(alias)); aliases.push(alias); }
    }
    barcode ??= o.barcode ?? null;
    productMeta ??= o.productMeta ?? null;
    category ??= o.category ?? null;
    if (o.expiresAt && (!expiresAt || o.expiresAt < expiresAt)) expiresAt = o.expiresAt;
    if (o.stockedAt > stockedAt) stockedAt = o.stockedAt;
  }

  return {
    quantity,
    unit: survivor.unit ?? null,
    category,
    tags,
    aliases,
    barcode,
    productMeta,
    expiresAt,
    stockedAt,
    unmergedQuantities: unmerged,
  };
}
