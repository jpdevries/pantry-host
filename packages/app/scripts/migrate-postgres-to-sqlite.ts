/**
 * One-shot Postgres → SQLite migration for pantry-host.
 *
 *   DATABASE_URL=postgres://… \
 *   SQLITE_DB_PATH=./pantry.db \
 *   npx tsx packages/app/scripts/migrate-postgres-to-sqlite.ts [--force]
 *
 * Reads every row from the source Postgres database and writes it into a
 * freshly-initialized SQLite database. Order respects FK dependencies.
 * Refuses to run if the destination already has data, unless `--force` is
 * passed (in which case the destination is wiped first).
 */
import { DatabaseSync } from 'node:sqlite';
import postgres from 'postgres';
import { SCHEMA_SQL } from '@pantry-host/shared/sql/schema';

const FORCE = process.argv.includes('--force');
const DEST_PATH = process.env.SQLITE_DB_PATH ?? './pantry.db';
const SOURCE_URL = process.env.DATABASE_URL;

if (!SOURCE_URL) {
  console.error('DATABASE_URL is required (source Postgres).');
  process.exit(1);
}
const SOURCE = SOURCE_URL as string;

type Row = Record<string, unknown>;

function toIso(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === 'string') return v;
  return String(v);
}

function toJsonArr(v: unknown): string {
  if (v == null) return '[]';
  if (Array.isArray(v)) return JSON.stringify(v);
  return '[]';
}

function toJsonArrNullable(v: unknown): string | null {
  if (v == null) return null;
  if (Array.isArray(v)) return JSON.stringify(v);
  return null;
}

function toJsonObj(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'string') return v;
  return JSON.stringify(v);
}

function toBit(v: unknown): number {
  return v ? 1 : 0;
}

async function main() {
  console.log(`[migrate] source: ${SOURCE.replace(/:[^:@/]+@/, ':***@')}`);
  console.log(`[migrate] dest:   ${DEST_PATH}`);

  const sql = postgres(SOURCE, { max: 4, connect_timeout: 10 });
  const dest = new DatabaseSync(DEST_PATH);
  dest.exec('PRAGMA journal_mode = WAL');
  dest.exec('PRAGMA foreign_keys = OFF'); // re-enabled after import
  dest.exec(SCHEMA_SQL);

  const existing = dest.prepare('SELECT COUNT(*) AS n FROM kitchens WHERE slug != ?').get('home') as { n: number };
  const homeIngredients = dest.prepare(
    `SELECT COUNT(*) AS n FROM ingredients WHERE kitchen_id IN (SELECT id FROM kitchens WHERE slug = 'home')`
  ).get() as { n: number };
  const hasData = existing.n > 0 || homeIngredients.n > 0;
  if (hasData && !FORCE) {
    console.error('Destination already has data. Re-run with --force to wipe and re-import.');
    await sql.end();
    process.exit(2);
  }
  if (hasData && FORCE) {
    console.log('[migrate] --force: wiping destination tables');
    for (const t of ['menu_recipes', 'menus', 'recipe_cookware', 'recipe_ingredients', 'recipes', 'cookware', 'ingredients', 'kitchens']) {
      dest.exec(`DELETE FROM ${t}`);
    }
  } else {
    // Fresh DB still has the auto-inserted 'home' kitchen — clear it so the
    // source's own 'home' kitchen (with its real UUID) can be re-inserted.
    dest.exec(`DELETE FROM kitchens WHERE slug = 'home'`);
  }

  const counts: Record<string, { src: number; dest: number }> = {};

  const insertTransaction = dest.prepare; // alias, just to avoid the lint

  function importTable(
    table: string,
    cols: string[],
    rows: Row[],
  ) {
    if (rows.length === 0) {
      counts[table] = { src: 0, dest: 0 };
      return;
    }
    const placeholders = cols.map(() => '?').join(',');
    const stmt = dest.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${placeholders})`);
    const begin = dest.prepare('BEGIN');
    const commit = dest.prepare('COMMIT');
    const rollback = dest.prepare('ROLLBACK');
    begin.run();
    try {
      for (const row of rows) {
        const vals = cols.map((c) => row[c] as null | number | bigint | string | Uint8Array);
        stmt.run(...vals);
      }
      commit.run();
    } catch (e) {
      rollback.run();
      throw e;
    }
    const got = dest.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    counts[table] = { src: rows.length, dest: got.n };
    console.log(`[migrate] ${table}: ${rows.length} → ${got.n}`);
  }

  // ── Read from Postgres ────────────────────────────────────────────────────
  const pgKitchens = await sql`SELECT * FROM kitchens` as unknown as Row[];
  const pgIngredients = await sql`SELECT * FROM ingredients` as unknown as Row[];
  const pgCookware = await sql`SELECT * FROM cookware` as unknown as Row[];
  const pgRecipes = await sql`SELECT * FROM recipes` as unknown as Row[];
  const pgMenus = await sql`SELECT * FROM menus` as unknown as Row[];
  const pgRecipeIngredients = await sql`SELECT * FROM recipe_ingredients` as unknown as Row[];
  const pgRecipeCookware = await sql`SELECT * FROM recipe_cookware` as unknown as Row[];
  const pgMenuRecipes = await sql`SELECT * FROM menu_recipes` as unknown as Row[];

  // ── Transform + write ─────────────────────────────────────────────────────
  importTable(
    'kitchens',
    ['id', 'slug', 'name', 'created_at'],
    pgKitchens.map((k) => ({
      id: String(k.id),
      slug: String(k.slug),
      name: String(k.name),
      created_at: toIso(k.created_at),
    })),
  );

  importTable(
    'ingredients',
    ['id', 'name', 'category', 'quantity', 'unit', 'item_size', 'item_size_unit', 'always_on_hand', 'tags', 'aliases', 'barcode', 'product_meta', 'kitchen_id', 'created_at', 'updated_at'],
    pgIngredients.map((r) => ({
      id: String(r.id),
      name: r.name,
      category: r.category ?? null,
      quantity: r.quantity == null ? null : Number(r.quantity),
      unit: r.unit ?? null,
      item_size: r.item_size == null ? null : Number(r.item_size),
      item_size_unit: r.item_size_unit ?? null,
      always_on_hand: toBit(r.always_on_hand),
      tags: toJsonArr(r.tags),
      aliases: toJsonArrNullable(r.aliases),
      barcode: r.barcode ?? null,
      product_meta: toJsonObj(r.product_meta),
      kitchen_id: String(r.kitchen_id),
      created_at: toIso(r.created_at),
      updated_at: toIso(r.updated_at),
    })),
  );

  importTable(
    'cookware',
    ['id', 'name', 'brand', 'tags', 'notes', 'kitchen_id', 'created_at'],
    pgCookware.map((r) => ({
      id: String(r.id),
      name: r.name,
      brand: r.brand ?? null,
      tags: toJsonArr(r.tags),
      notes: r.notes ?? null,
      kitchen_id: String(r.kitchen_id),
      created_at: toIso(r.created_at),
    })),
  );

  importTable(
    'recipes',
    ['id', 'title', 'slug', 'description', 'instructions', 'servings', 'prep_time', 'cook_time', 'tags', 'step_photos', 'source', 'source_url', 'photo_url', 'last_made_at', 'queued', 'kitchen_id', 'created_at'],
    pgRecipes.map((r) => ({
      id: String(r.id),
      title: r.title,
      slug: r.slug ?? null,
      description: r.description ?? null,
      instructions: r.instructions,
      servings: r.servings ?? null,
      prep_time: r.prep_time ?? null,
      cook_time: r.cook_time ?? null,
      tags: toJsonArr(r.tags),
      step_photos: toJsonArr(r.step_photos),
      source: r.source ?? 'manual',
      source_url: r.source_url ?? null,
      photo_url: r.photo_url ?? null,
      last_made_at: toIso(r.last_made_at),
      queued: toBit(r.queued),
      kitchen_id: String(r.kitchen_id),
      created_at: toIso(r.created_at),
    })),
  );

  importTable(
    'menus',
    ['id', 'title', 'slug', 'description', 'active', 'category', 'source_url', 'kitchen_id', 'created_at'],
    pgMenus.map((r) => ({
      id: String(r.id),
      title: r.title,
      slug: r.slug ?? null,
      description: r.description ?? null,
      active: toBit(r.active ?? true),
      category: r.category ?? null,
      source_url: r.source_url ?? null,
      kitchen_id: String(r.kitchen_id),
      created_at: toIso(r.created_at),
    })),
  );

  importTable(
    'recipe_ingredients',
    ['id', 'recipe_id', 'ingredient_name', 'quantity', 'unit', 'item_size', 'item_size_unit', 'source_recipe_id', 'sort_order'],
    pgRecipeIngredients.map((r) => ({
      id: String(r.id),
      recipe_id: r.recipe_id == null ? null : String(r.recipe_id),
      ingredient_name: r.ingredient_name,
      quantity: r.quantity == null ? null : Number(r.quantity),
      unit: r.unit ?? null,
      item_size: r.item_size == null ? null : Number(r.item_size),
      item_size_unit: r.item_size_unit ?? null,
      source_recipe_id: r.source_recipe_id == null ? null : String(r.source_recipe_id),
      sort_order: r.sort_order ?? 0,
    })),
  );

  importTable(
    'recipe_cookware',
    ['recipe_id', 'cookware_id'],
    pgRecipeCookware.map((r) => ({
      recipe_id: String(r.recipe_id),
      cookware_id: String(r.cookware_id),
    })),
  );

  importTable(
    'menu_recipes',
    ['id', 'menu_id', 'recipe_id', 'course', 'sort_order'],
    pgMenuRecipes.map((r) => ({
      id: String(r.id),
      menu_id: String(r.menu_id),
      recipe_id: String(r.recipe_id),
      course: r.course ?? null,
      sort_order: r.sort_order ?? 0,
    })),
  );

  dest.exec('PRAGMA foreign_keys = ON');
  // Verify FKs settled cleanly.
  const fkCheck = dest.prepare('PRAGMA foreign_key_check').all() as Row[];
  if (fkCheck.length > 0) {
    console.error('[migrate] foreign-key violations after import:');
    console.error(fkCheck);
    await sql.end();
    process.exit(3);
  }

  await sql.end();
  dest.close();

  console.log('\n[migrate] Done. Row counts (source → dest):');
  for (const [table, c] of Object.entries(counts)) {
    const ok = c.src === c.dest ? 'OK ' : 'BAD';
    console.log(`  [${ok}] ${table.padEnd(20)}  ${c.src} → ${c.dest}`);
  }
  const mismatched = Object.entries(counts).filter(([_, c]) => c.src !== c.dest);
  if (mismatched.length > 0) {
    console.error(`[migrate] ${mismatched.length} table(s) had count mismatch`);
    process.exit(4);
  }
}

main().catch((err) => {
  console.error('[migrate] failed:', err);
  process.exit(1);
});
