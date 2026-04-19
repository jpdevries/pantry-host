/**
 * Backfill script — for pantry rows in produce-ish categories
 * that don't yet have a barcode or PLU attached, try to resolve
 * their name against the IFPS dataset and attach the matching PLU.
 *
 * After this runs:
 *   - Row "Bananas" picks up barcode = "4011" + product_meta
 *     populated with { plu_source: 'ifps', commodity: 'Bananas',
 *     variety: 'Yellow (includes Cavendish)', size: 'All Sizes',
 *     category: 'Fruits' }.
 *   - The pantry filter's `barcode?.includes(q)` predicate now
 *     matches `4011` → lands on the banana row. Same affordance
 *     barcoded packaged goods get.
 *
 * Conservative by design: only attaches a PLU when the top name
 * match is `confidence: "exact"` AND the matched variety looks
 * like an IFPS "generic catchall" (the phrasing IFPS uses for
 * "this is THE PLU for this commodity"). That keeps the script
 * from mis-tagging "Gala Apples" as generic apples, since there's
 * no "Apples (includes all varieties)" entry in IFPS — only
 * cultivar-specific rows.
 *
 * Dry-run by default. Pass `--apply` to write.
 *
 *   DATABASE_URL=postgres://j7@100.125.77.118:5432/pantry_host \
 *     npx tsx packages/app/scripts/backfill-produce-plu.ts
 *   DATABASE_URL=… npx tsx packages/app/scripts/backfill-produce-plu.ts --apply
 */

import postgres from 'postgres';
import {
  lookupPluByName,
  type PluCandidate,
} from '../../shared/src/plu';
import { buildPluMeta } from '../../shared/src/plu';

// Pantry Host categories → IFPS categories. Only rows in these
// Pantry buckets are candidates; everything else (canned, dairy,
// meat, etc.) is UPC/EAN territory.
const PANTRY_TO_IFPS: Record<string, string> = {
  fruit: 'Fruits',
  vegetables: 'Vegetables',
  'fresh herbs': 'Herbs',
  'nuts & seeds': 'Nuts',
};
const PANTRY_CATEGORIES = Object.keys(PANTRY_TO_IFPS);

/**
 * Decide whether the top candidate is confident enough to
 * auto-attach. The goal is high precision, low recall — we'd
 * rather skip an ambiguous row than wrongly stamp it.
 *
 * Rules (ALL must hold):
 *   1. confidence === "exact" (commodity matched literally,
 *      not just a substring or variety/aka/botanical hit)
 *   2. The candidate's IFPS category matches the Pantry row's
 *      category via PANTRY_TO_IFPS — i.e. "Cilantro" in Pantry
 *      "fresh herbs" resolves to IFPS Herbs, not the cilantro-
 *      named pepper variety in Vegetables.
 *   3. The top hit's variety is a "generic catchall" — IFPS
 *      marks these with phrasing like "Yellow (includes
 *      Cavendish)", "All Varieties", or a null variety. If the
 *      only exact hits are cultivar-specific (every variety is
 *      named), the row gets left alone for a human to pick.
 */
function isConfidentMatch(candidate: PluCandidate, pantryCategory: string): boolean {
  if (candidate.confidence !== 'exact') return false;
  const expectedIfps = PANTRY_TO_IFPS[pantryCategory.toLowerCase()];
  if (expectedIfps && candidate.category !== expectedIfps) return false;
  if (!candidate.variety) return true;
  const v = candidate.variety.toLowerCase();
  return (
    v.includes('includes ') ||
    v === 'all varieties' ||
    v === 'other' ||
    v === 'regular'
  );
}

async function main() {
  const apply = process.argv.includes('--apply');
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('DATABASE_URL is required');
    process.exit(1);
  }
  console.log(`[mode] ${apply ? 'APPLY (will write)' : 'DRY RUN (read-only)'}`);

  const sql = postgres(dbUrl);
  try {
    const rows = await sql<Array<{ id: string; name: string; category: string }>>`
      SELECT id, name, category
      FROM ingredients
      WHERE (barcode IS NULL OR barcode = '')
        AND LOWER(category) IN ${sql(PANTRY_CATEGORIES)}
      ORDER BY category, name
    `;
    console.log(`[scope] ${rows.length} produce-ish ingredients without a barcode/PLU`);
    console.log();

    let applied = 0;
    let skipped = 0;
    let ambiguous = 0;

    for (const row of rows) {
      const candidates = lookupPluByName(row.name);
      if (!candidates.length) {
        console.log(`  ✗ ${row.name.padEnd(40)}  no match`);
        skipped++;
        continue;
      }
      const top = candidates[0];
      const confident = isConfidentMatch(top, row.category);

      if (!confident) {
        // Ambiguous — show top 3 for visibility but don't write.
        const summary = candidates
          .slice(0, 3)
          .map((c) => `${c.plu}/${c.variety ?? '-'} (${c.confidence})`)
          .join(', ');
        console.log(`  ~ ${row.name.padEnd(40)}  ambiguous: ${summary}`);
        ambiguous++;
        continue;
      }

      console.log(
        `  ✓ ${row.name.padEnd(40)}  →  ${top.plu}  ${top.commodity}${
          top.variety ? ` / ${top.variety}` : ''
        }`,
      );
      applied++;

      if (apply) {
        // buildPluMeta needs the base PluRecord shape (no organic
        // flag on dataset rows — organic is requested at lookup
        // time). We're always writing the conventional variant;
        // users can flip to the 9XXXX form manually if they want
        // to track organic explicitly.
        const meta = buildPluMeta({
          plu: top.plu,
          category: top.category,
          commodity: top.commodity,
          variety: top.variety,
          size: top.size,
          aka: top.aka,
          botanical: top.botanical,
          type: top.type,
        });
        await sql`
          UPDATE ingredients
          SET barcode = ${top.plu},
              product_meta = ${sql.json(meta as never)}
          WHERE id = ${row.id}
        `;
      }
    }

    console.log();
    console.log('[summary]');
    console.log(`  attached:   ${applied}`);
    console.log(`  ambiguous:  ${ambiguous}`);
    console.log(`  no match:   ${skipped}`);
    if (!apply) {
      console.log();
      console.log('[next step] re-run with --apply to write the ✓ rows');
    }
  } finally {
    await sql.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
