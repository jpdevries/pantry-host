import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

/**
 * The schema is CREATE TABLE IF NOT EXISTS only, so a database created
 * before a column existed never gets it from the schema. `migrations.json`
 * is the shared list every runtime applies after the schema, guarded by
 * pragma_table_info because SQLite's ADD COLUMN has no IF NOT EXISTS.
 * The Rust server has its own unit test for its copy of the guard
 * (src/db.rs); this one checks the JSON contract itself and the
 * pragma_table_info guard on node:sqlite, which the app and web tiers use.
 */
const SQL_DIR = join(import.meta.dirname, '..', '..', 'packages', 'shared', 'src', 'sql');
const SCHEMA_SQL = readFileSync(join(SQL_DIR, 'schema.sql'), 'utf8');
const MIGRATIONS = JSON.parse(readFileSync(join(SQL_DIR, 'migrations.json'), 'utf8')) as {
  table: string; column: string; ddl: string;
}[];

function columnsOf(db: DatabaseSync, table: string): string[] {
  return (db.prepare('SELECT name FROM pragma_table_info(?)').all(table) as { name: string }[]).map((r) => r.name);
}

/** Same guard as packages/shared/src/sql/migrations.ts `pendingMigrations`. */
function pending(db: DatabaseSync): string[] {
  return MIGRATIONS.filter((m) => !columnsOf(db, m.table).map((c) => c.toLowerCase()).includes(m.column.toLowerCase())).map((m) => m.ddl);
}

describe('column migrations', () => {
  it('every entry names a column that the current schema also declares', () => {
    const fresh = new DatabaseSync(':memory:');
    fresh.exec(SCHEMA_SQL);
    for (const m of MIGRATIONS) {
      assert.ok(columnsOf(fresh, m.table).includes(m.column), `${m.table}.${m.column} missing from schema.sql`);
      assert.match(m.ddl, new RegExp(`^ALTER TABLE ${m.table} ADD COLUMN ${m.column}\\b`));
    }
    assert.deepEqual(pending(fresh), [], 'a fresh database needs no migration');
  });

  it('upgrades a database whose ingredients table predates the migrated columns', () => {
    const db = new DatabaseSync(':memory:');
    // Rebuild the schema with the migrated columns removed, as an older install would have it.
    let old = SCHEMA_SQL;
    for (const m of MIGRATIONS) {
      old = old.replace(new RegExp(`^\\s*${m.column}\\s+TEXT,\\n`, 'm'), '');
      assert.ok(!old.includes(`  ${m.column} `), `could not strip ${m.column} from the schema`);
    }
    db.exec(old);
    assert.ok(!columnsOf(db, 'ingredients').includes('expires_at'));

    // What each runtime does on boot: schema, then whatever is pending.
    db.exec(SCHEMA_SQL);
    const first = pending(db);
    assert.equal(first.length, MIGRATIONS.length);
    for (const ddl of first) db.exec(ddl);
    assert.deepEqual(pending(db), [], 'idempotent');
    for (const m of MIGRATIONS) assert.ok(columnsOf(db, m.table).includes(m.column));

    // Existing rows survive with nulls in the new columns, and new rows can fill them.
    const [kitchen] = db.prepare("SELECT id FROM kitchens WHERE slug = 'home'").all() as { id: string }[];
    db.prepare("INSERT INTO ingredients (id, name, kitchen_id) VALUES ('old', 'Flour', ?)").run(kitchen.id);
    db.prepare("INSERT INTO ingredients (id, name, kitchen_id, expires_at, stocked_at) VALUES ('new', 'Milk', ?, '2026-11-10', '2026-11-01T00:00:00.000Z')").run(kitchen.id);
    // node:sqlite rows have a null prototype; spread them so strict deepEqual compares values only.
    const rows = (db.prepare('SELECT id, expires_at, stocked_at FROM ingredients ORDER BY id').all() as { id: string; expires_at: string | null; stocked_at: string | null }[]).map((r) => ({ ...r }));
    assert.deepEqual(rows, [
      { id: 'new', expires_at: '2026-11-10', stocked_at: '2026-11-01T00:00:00.000Z' },
      { id: 'old', expires_at: null, stocked_at: null },
    ]);
  });
});
