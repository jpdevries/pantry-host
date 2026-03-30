/**
 * Migration: required_cookware TEXT[] → recipe_cookware join table
 *
 * Run: npx tsx packages/app/scripts/migrate-cookware-to-uuid.ts
 *
 * Idempotent — safe to run multiple times.
 */

import sql from '../lib/db';

async function main() {
  console.log('=== Cookware UUID migration ===\n');

  // 1. Pre-migration audit
  const recipes = await sql`SELECT id, title, required_cookware FROM recipes WHERE required_cookware != '{}'`;
  console.log(`Recipes with required_cookware: ${recipes.length}`);
  for (const r of recipes) {
    console.log(`  ${r.title}: [${(r.required_cookware as string[]).join(', ')}]`);
  }

  const allCookware = await sql`SELECT id, name FROM cookware`;
  const nameToId = Object.fromEntries(allCookware.map((c: any) => [c.name, c.id]));
  console.log(`\nCookware items: ${allCookware.length}`);

  // 2. Create join table (IF NOT EXISTS — idempotent)
  await sql`
    CREATE TABLE IF NOT EXISTS recipe_cookware (
      recipe_id   UUID NOT NULL REFERENCES recipes(id)  ON DELETE CASCADE,
      cookware_id UUID NOT NULL REFERENCES cookware(id) ON DELETE CASCADE,
      PRIMARY KEY (recipe_id, cookware_id)
    )
  `;
  await sql`CREATE INDEX IF NOT EXISTS idx_recipe_cookware_recipe   ON recipe_cookware(recipe_id)`;
  await sql`CREATE INDEX IF NOT EXISTS idx_recipe_cookware_cookware ON recipe_cookware(cookware_id)`;
  console.log('\n✓ recipe_cookware table ready');

  // 3. Backfill
  let inserted = 0;
  const unmatched: { recipe: string; name: string }[] = [];

  for (const r of recipes) {
    for (const name of (r.required_cookware as string[])) {
      const cookwareId = nameToId[name];
      if (!cookwareId) {
        unmatched.push({ recipe: r.title, name });
        continue;
      }
      await sql`
        INSERT INTO recipe_cookware (recipe_id, cookware_id)
        VALUES (${r.id}, ${cookwareId})
        ON CONFLICT DO NOTHING
      `;
      inserted++;
    }
  }

  console.log(`\n✓ Inserted ${inserted} recipe_cookware rows`);

  if (unmatched.length > 0) {
    console.warn(`\n⚠ ${unmatched.length} unmatched cookware name(s) — no row in cookware table:`);
    for (const u of unmatched) {
      console.warn(`  Recipe "${u.recipe}" → "${u.name}"`);
    }
  }

  // 4. Verify
  const [{ count }] = await sql`SELECT COUNT(*) FROM recipe_cookware` as any[];
  console.log(`\n✓ recipe_cookware total rows: ${count}`);

  // 5. Drop old column
  await sql`DROP INDEX IF EXISTS idx_recipes_cookware`;
  await sql`ALTER TABLE recipes DROP COLUMN IF EXISTS required_cookware`;
  console.log('✓ Dropped required_cookware column and GIN index');

  console.log('\n=== Migration complete ===');
  process.exit(0);
}

main().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
