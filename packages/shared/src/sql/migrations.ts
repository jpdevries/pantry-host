/**
 * Column migrations for databases created before a column existed.
 *
 * `schema.sql` is `CREATE TABLE IF NOT EXISTS` only, so it never adds a
 * column to a table that already exists. Every column added after its table
 * first shipped goes in `migrations.json` (the Rust server `include_str!`s
 * that file), and each runtime applies the missing ones right after the
 * schema:
 *
 *   - packages/app/lib/db.ts        (Node, node:sqlite)
 *   - packages/web/lib/db.worker.ts (browser, @sqlite.org/sqlite-wasm)
 *   - packages/server/src/db.rs     (Rust, rusqlite)
 *
 * SQLite's `ALTER TABLE … ADD COLUMN` has no `IF NOT EXISTS`, so the guard
 * is a `pragma_table_info` lookup per table. Add the column to `schema.sql`
 * and `schema.ts` too, so fresh installs get it from the CREATE TABLE.
 */

import migrations from './migrations.json';

export interface ColumnMigration {
  table: string;
  column: string;
  /** The `ALTER TABLE … ADD COLUMN …` statement. Must be safe to run once. */
  ddl: string;
}

export const COLUMN_MIGRATIONS: readonly ColumnMigration[] = migrations;

/**
 * The DDL statements still to run against a database, in order.
 *
 * `columnsOf(table)` returns the table's current column names (the `name`
 * column of `SELECT name FROM pragma_table_info(?)`). Pure, so each runtime
 * only supplies the lookup and runs what comes back.
 */
export function pendingMigrations(columnsOf: (table: string) => string[]): string[] {
  const seen = new Map<string, Set<string>>();
  const out: string[] = [];
  for (const m of COLUMN_MIGRATIONS) {
    let cols = seen.get(m.table);
    if (!cols) {
      cols = new Set(columnsOf(m.table).map((c) => c.toLowerCase()));
      seen.set(m.table, cols);
    }
    if (!cols.has(m.column.toLowerCase())) out.push(m.ddl);
  }
  return out;
}
