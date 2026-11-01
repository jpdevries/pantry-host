import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  estimatedExpiry,
  findDuplicates,
  pickSurvivor,
  planMerge,
  reviewPantry,
  shelfLife,
  type PantryRowForReview,
  type ReviewFinding,
} from './pantry-review';

// Fixed clock so the fixtures never age.
const NOW = new Date('2026-11-01T12:00:00.000Z').getTime();
const DAY = 24 * 60 * 60 * 1000;
const daysAgo = (n: number) => new Date(NOW - n * DAY).toISOString();
const daysAhead = (n: number) => new Date(NOW + n * DAY).toISOString();

let seq = 0;
function row(over: Partial<PantryRowForReview> & { name: string }): PantryRowForReview {
  seq += 1;
  return {
    id: over.id ?? `r${seq}`,
    aliases: [],
    category: 'other',
    quantity: 1,
    unit: null,
    alwaysOnHand: false,
    tags: [],
    barcode: null,
    productMeta: null,
    expiresAt: null,
    stockedAt: daysAgo(1),
    updatedAt: daysAgo(1),
    createdAt: daysAgo(1),
    ...over,
  };
}

const review = (rows: PantryRowForReview[], opts = {}) => reviewPantry(rows, { now: NOW, ...opts });
const signalsFor = (findings: ReviewFinding[], id: string) =>
  findings.filter((f) => f.ids.includes(id)).map((f) => f.signal).sort();

describe('shelfLife', () => {
  it('uses the pantry category by default', () => {
    assert.deepEqual(shelfLife({ category: 'dairy', tags: [], productMeta: null }), { days: 14, source: 'category', category: 'dairy' });
    assert.deepEqual(shelfLife({ category: 'other', tags: [], productMeta: null }), { days: null, source: 'none' });
    assert.deepEqual(shelfLife({ category: null, tags: [], productMeta: null }), { days: null, source: 'none' });
  });

  it('a frozen tag overrides the category', () => {
    const b = shelfLife({ category: 'meat & poultry', tags: ['Frozen'], productMeta: null });
    assert.equal(b.days, 180);
    assert.equal(b.source, 'frozen-tag');
  });

  it('Open Food Facts category tags refine the estimate for scanned rows', () => {
    const uht = shelfLife({ category: 'dairy', tags: [], productMeta: JSON.stringify({ categories_tags: ['en:dairies', 'en:milks', 'en:uht-milks'] }) });
    assert.equal(uht.days, 180);
    assert.equal(uht.source, 'off');
    const canned = shelfLife({ category: 'vegetables', tags: [], productMeta: JSON.stringify({ main_category: 'en:canned-tomatoes' }) });
    assert.equal(canned.days, 730);
  });

  it('ignores IFPS produce metadata, which carries no shelf-life hint', () => {
    const b = shelfLife({ category: 'fruit', tags: [], productMeta: JSON.stringify({ plu_source: 'ifps', commodity: 'Bananas', category: 'Fruits' }) });
    assert.deepEqual(b, { days: 7, source: 'category', category: 'fruit' });
  });
});

describe('estimatedExpiry', () => {
  it('a stated date wins and is marked explicit', () => {
    const e = estimatedExpiry(row({ name: 'Milk', category: 'dairy', expiresAt: '2026-11-10', stockedAt: daysAgo(30) }));
    assert.equal(e?.provenance, 'explicit');
    assert.equal(e?.date, new Date('2026-11-10').toISOString());
  });

  it('otherwise derives from stockedAt plus shelf life', () => {
    const e = estimatedExpiry(row({ name: 'Milk', category: 'dairy', stockedAt: daysAgo(4) }));
    assert.equal(e?.provenance, 'estimated');
    assert.equal(e?.date, daysAhead(10));
  });

  it('is null for always-on-hand rows and for categories without a shelf life', () => {
    assert.equal(estimatedExpiry(row({ name: 'Salt', category: 'herbs & spices', alwaysOnHand: true })), null);
    assert.equal(estimatedExpiry(row({ name: 'Mystery', category: 'other' })), null);
  });
});

describe('reviewPantry', () => {
  it('flags an expired estimate and an expired stated date, with provenance', () => {
    const yogurt = row({ id: 'yogurt', name: 'Yogurt', category: 'dairy', stockedAt: daysAgo(20) });
    const ham = row({ id: 'ham', name: 'Ham', category: 'deli & charcuterie', expiresAt: daysAgo(2), stockedAt: daysAgo(3) });
    const { findings, counts } = review([yogurt, ham]);
    const y = findings.find((f) => f.ids[0] === 'yogurt')!;
    assert.equal(y.signal, 'expired');
    assert.equal(y.provenance, 'estimated');
    assert.match(y.reason, /estimated best-by passed 6 days ago \(estimated from dairy, stocked 20 days ago\)/);
    const h = findings.find((f) => f.ids[0] === 'ham')!;
    assert.equal(h.signal, 'expired');
    assert.equal(h.provenance, 'explicit');
    assert.match(h.reason, /^best-by passed 2 days ago \(stated/);
    assert.equal(counts.expired, 2);
  });

  it('flags expiring within the horizon and nothing before it', () => {
    const eggs = row({ id: 'eggs', name: 'Eggs', category: 'eggs', stockedAt: daysAgo(26) }); // 2 days left
    const fresh = row({ id: 'fresh', name: 'Eggs 2', category: 'eggs', stockedAt: daysAgo(10) }); // 18 days left
    const { findings } = review([eggs, fresh]);
    assert.deepEqual(signalsFor(findings, 'eggs'), ['expiring']);
    assert.match(findings[0].reason, /2 days left/);
    assert.deepEqual(signalsFor(findings, 'fresh'), []);
  });

  it('a restocked jar does not flag even though the row is old', () => {
    const jar = row({ id: 'jar', name: 'Tomato Sauce', category: 'canned & jarred', createdAt: daysAgo(900), stockedAt: daysAgo(2), updatedAt: daysAgo(2) });
    assert.deepEqual(review([jar]).findings, []);
  });

  it('a frozen steak does not flag at ten days', () => {
    const steak = row({ id: 'steak', name: 'Ribeye', category: 'meat & poultry', tags: ['frozen'], stockedAt: daysAgo(10) });
    assert.deepEqual(review([steak]).findings, []);
  });

  it('UHT milk scanned from a barcode is not treated as fresh dairy', () => {
    const uht = row({ id: 'uht', name: 'Oat Milk', category: 'dairy', barcode: '7394376616358', productMeta: JSON.stringify({ categories_tags: ['en:uht-milks'] }), stockedAt: daysAgo(20) });
    assert.deepEqual(review([uht]).findings, []);
  });

  it('always-on-hand rows never flag', () => {
    const salt = row({ id: 'salt', name: 'Salt', category: 'herbs & spices', alwaysOnHand: true, quantity: null, stockedAt: daysAgo(2000), updatedAt: daysAgo(2000) });
    assert.deepEqual(review([salt]).findings, []);
  });

  it('stale: only rows with no shelf-life basis, untouched for 180 days', () => {
    const paprika = row({ id: 'paprika', name: 'Paprika', category: 'herbs & spices', stockedAt: daysAgo(800) }); // past its estimate → expired, not stale
    const mystery = row({ id: 'mystery', name: 'Mystery Jar', category: 'other', stockedAt: daysAgo(200) });
    const young = row({ id: 'young', name: 'Odd Tin', category: 'other', stockedAt: daysAgo(100) });
    const { findings } = review([paprika, mystery, young]);
    assert.deepEqual(signalsFor(findings, 'paprika'), ['expired']);
    const m = findings.find((f) => f.ids[0] === 'mystery')!;
    assert.equal(m.signal, 'stale');
    assert.match(m.reason, /untouched for 200 days and no shelf-life estimate for other items/);
    assert.deepEqual(signalsFor(findings, 'young'), []);
  });

  it('a stated future date suppresses the stale nudge', () => {
    const honey = row({ id: 'honey', name: 'Honey', category: 'other', expiresAt: daysAhead(300), stockedAt: daysAgo(400) });
    assert.deepEqual(review([honey]).findings, []);
  });

  it('out of stock: quantity 0 for longer than the window, and nothing sooner', () => {
    const old = row({ id: 'old', name: 'Lemons', category: 'fruit', quantity: 0, updatedAt: daysAgo(20) });
    const recent = row({ id: 'recent', name: 'Limes', category: 'fruit', quantity: 0, updatedAt: daysAgo(3) });
    const { findings } = review([old, recent]);
    assert.deepEqual(signalsFor(findings, 'old'), ['outOfStock']);
    assert.match(findings[0].reason, /out of stock for 20 days/);
    assert.deepEqual(signalsFor(findings, 'recent'), []);
  });

  it('respects the signals filter and option overrides', () => {
    const yogurt = row({ id: 'yogurt', name: 'Yogurt', category: 'dairy', stockedAt: daysAgo(20) });
    const mystery = row({ id: 'mystery', name: 'Mystery Jar', category: 'other', stockedAt: daysAgo(100) });
    assert.deepEqual(review([yogurt, mystery], { signals: ['stale'] }).findings, []);
    assert.deepEqual(signalsFor(review([yogurt, mystery], { signals: ['stale'], staleDays: 90 }).findings, 'mystery'), ['stale']);
    assert.equal(review([yogurt], { expiringWithinDays: 0 }).counts.expired, 1);
  });

  it('counts and flaggedIds summarise the findings', () => {
    const a = row({ id: 'a', name: 'Garlic', category: 'vegetables', stockedAt: daysAgo(30) });
    const b = row({ id: 'b', name: 'garlic', category: 'vegetables', stockedAt: daysAgo(1) });
    const { counts, flaggedIds } = review([a, b]);
    assert.deepEqual(counts, { expired: 1, expiring: 0, stale: 0, duplicate: 1, outOfStock: 0 });
    assert.deepEqual([...flaggedIds].sort(), ['a', 'b']);
  });
});

describe('findDuplicates', () => {
  it('groups the garlic triplet by name, alias and barcode into one finding', () => {
    const a = row({ id: 'a', name: 'Garlic', category: 'vegetables', stockedAt: daysAgo(10) });
    const b = row({ id: 'b', name: 'garlic', category: 'vegetables', stockedAt: daysAgo(2), tags: ['costco'] });
    const c = row({ id: 'c', name: 'Garlic Cloves', category: 'vegetables', aliases: ['garlic'], stockedAt: daysAgo(5) });
    const d = row({ id: 'd', name: 'Peeled Garlic', barcode: '0001', stockedAt: daysAgo(1) });
    const e = row({ id: 'e', name: 'Ajo', barcode: '0001', stockedAt: daysAgo(4) });
    const unrelated = row({ id: 'f', name: 'Onion' });
    const found = findDuplicates([a, b, c, d, e, unrelated]);
    assert.equal(found.length, 2);
    const garlic = found.find((f) => f.ids.includes('a'))!;
    assert.deepEqual([...garlic.ids].sort(), ['a', 'b', 'c']);
    assert.equal(garlic.survivorId, 'b', 'most recently stocked');
    assert.deepEqual([...garlic.matchedOn!].sort(), ['alias', 'name']);
    assert.match(garlic.reason, /look like the same item \((same name|alias overlap), (same name|alias overlap)\)/);
    const bc = found.find((f) => f.ids.includes('d'))!;
    assert.deepEqual([...bc.ids].sort(), ['d', 'e']);
    assert.deepEqual(bc.matchedOn, ['barcode']);
    assert.equal(bc.survivorId, 'd');
  });

  it('normalises prep notes and parentheticals before comparing names', () => {
    const a = row({ id: 'a', name: 'Cream cheese, softened' });
    const b = row({ id: 'b', name: 'Cream Cheese (8 oz)' });
    assert.equal(findDuplicates([a, b]).length, 1);
  });

  it('does not treat distinct items as duplicates', () => {
    const rows = [row({ name: 'Olive Oil' }), row({ name: 'Oil' }), row({ name: 'Peanut Butter' }), row({ name: 'Butter' })];
    assert.deepEqual(findDuplicates(rows), []);
  });
});

describe('pickSurvivor', () => {
  it('prefers newest stock, then barcode metadata, then more tags', () => {
    const plain = row({ id: 'plain', name: 'A', stockedAt: daysAgo(5) });
    const scanned = row({ id: 'scanned', name: 'A', stockedAt: daysAgo(5), barcode: '1' });
    const tagged = row({ id: 'tagged', name: 'A', stockedAt: daysAgo(5), tags: ['x', 'y'] });
    const newest = row({ id: 'newest', name: 'A', stockedAt: daysAgo(1) });
    assert.equal(pickSurvivor([plain, scanned, tagged, newest]).id, 'newest');
    assert.equal(pickSurvivor([plain, scanned, tagged]).id, 'scanned');
    assert.equal(pickSurvivor([plain, tagged]).id, 'tagged');
  });
});

describe('planMerge', () => {
  it('mirrors mergeIngredients: sums compatible quantities, unions tags, aliases the merged names, earliest expiry, latest stock', () => {
    const survivor = row({ id: 's', name: 'Garlic', quantity: 3, unit: 'whole', tags: ['costco'], stockedAt: daysAgo(10), expiresAt: daysAhead(10) });
    const o1 = row({ id: 'o1', name: 'garlic cloves', quantity: 5, unit: 'whole', tags: ['farmers-market', 'Costco'], aliases: ['garlic clove'], stockedAt: daysAgo(2), expiresAt: daysAhead(4) });
    const o2 = row({ id: 'o2', name: 'Ajo', quantity: 8, unit: 'oz', barcode: '0001', stockedAt: daysAgo(30) });
    const plan = planMerge(survivor, [o1, o2, survivor]);
    assert.equal(plan.quantity, 8);
    assert.deepEqual(plan.tags, ['costco', 'farmers-market']);
    assert.deepEqual(plan.aliases, ['garlic cloves', 'garlic clove', 'Ajo']);
    assert.equal(plan.barcode, '0001');
    assert.equal(plan.expiresAt, daysAhead(4));
    assert.equal(plan.stockedAt, daysAgo(2));
    assert.deepEqual(plan.unmergedQuantities, ['Ajo']);
  });

  it('converts units and respects item sizes', () => {
    const survivor = row({ id: 's', name: 'Olive Oil', quantity: 2, unit: 'cup' });
    const flOz = row({ id: 'a', name: 'EVOO', quantity: 16, unit: 'fl oz' });
    const jars = row({ id: 'b', name: 'Olive Oil', quantity: 1, unit: 'cup', itemSize: 12, itemSizeUnit: 'fl oz' });
    const plan = planMerge(survivor, [flOz, jars]);
    assert.equal(plan.quantity, 4);
    assert.deepEqual(plan.unmergedQuantities, ['Olive Oil']);
  });

  it('leaves an always-on-hand survivor untracked', () => {
    const survivor = row({ id: 's', name: 'Salt', alwaysOnHand: true, quantity: null });
    const plan = planMerge(survivor, [row({ name: 'sea salt', quantity: 2, unit: 'cup' })]);
    assert.equal(plan.quantity, null);
    assert.deepEqual(plan.unmergedQuantities, []);
    assert.deepEqual(plan.aliases, ['sea salt']);
  });
});
