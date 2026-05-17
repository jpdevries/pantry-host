import { DatabaseSync, type StatementSync } from 'node:sqlite';
import { SCHEMA_SQL } from '@pantry-host/shared/sql/schema';

let _db: DatabaseSync | undefined;
let _schemaApplied = false;

function getDB(): DatabaseSync {
  if (_db) return _db;
  const path = process.env.SQLITE_DB_PATH ?? './pantry.db';
  const db = new DatabaseSync(path);
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA busy_timeout = 5000');
  if (!_schemaApplied) {
    db.exec(SCHEMA_SQL);
    _schemaApplied = true;
  }
  _db = db;
  return db;
}

const RETURNS_ROWS = /^\s*(select|with|pragma)\b|\breturning\b/i;

function execute(text: string, params: unknown[]): Promise<unknown[]> {
  const db = getDB();
  let stmt: StatementSync;
  try {
    stmt = db.prepare(text);
  } catch (err) {
    const e = err as Error;
    e.message = `${e.message}\n  in: ${text}\n  params: ${JSON.stringify(params)}`;
    throw e;
  }
  // Normalize JS values to SQLite-compatible types.
  const bound = params.map((v) => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return v.toISOString();
    return v as null | number | bigint | string | Uint8Array;
  });
  if (RETURNS_ROWS.test(text)) {
    return Promise.resolve(stmt.all(...bound) as unknown[]);
  }
  stmt.run(...bound);
  return Promise.resolve([]);
}

/**
 * Tagged-template `sql` wrapper that mimics the call sites we used with
 * postgres.js, but speaks SQLite.
 *
 * - Each `${value}` becomes a `?` placeholder.
 * - If a value is a JS array, it's expanded inline as `?, ?, ?` and the
 *   elements are flattened into the parameter list. Use this for `IN (...)`,
 *   `VALUES (...)` lists, and `json_each` overlap subqueries. Wrap the
 *   placeholder in your own parens in the SQL.
 * - For JSON columns (`tags`, `step_photos`, `aliases`, `product_meta`), the
 *   caller is responsible for `JSON.stringify`-ing the value.
 */
type SqlResult<T> = Promise<T[]>;

function sqlTag<T = Record<string, unknown>>(
  strings: TemplateStringsArray,
  ...values: unknown[]
): SqlResult<T> {
  let text = '';
  const params: unknown[] = [];
  for (let i = 0; i < strings.length; i++) {
    text += strings[i];
    if (i < values.length) {
      const v = values[i];
      if (Array.isArray(v)) {
        if (v.length === 0) {
          text += 'NULL';
        } else {
          text += v.map(() => '?').join(', ');
          params.push(...v);
        }
      } else {
        text += '?';
        params.push(v);
      }
    }
  }
  return execute(text, params) as SqlResult<T>;
}

/**
 * Bulk insert helper. Returns inserted rows (RETURNING *).
 *
 *   await bulkInsert('ingredients',
 *     rows.map(r => ({ id: r.id, name: r.name, tags: JSON.stringify(r.tags) })),
 *     ['id', 'name', 'tags']);
 */
export function bulkInsert<T = Record<string, unknown>>(
  table: string,
  rows: Record<string, unknown>[],
  cols: string[],
): Promise<T[]> {
  if (rows.length === 0) return Promise.resolve([]);
  const placeholders = rows
    .map(() => `(${cols.map(() => '?').join(',')})`)
    .join(', ');
  const params = rows.flatMap((r) => cols.map((c) => r[c]));
  const sqlText = `INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders} RETURNING *`;
  return execute(sqlText, params) as Promise<T[]>;
}

/** Run any SQL not expressible as a single tagged template (rare). */
export function rawExec(text: string, params: unknown[] = []): Promise<unknown[]> {
  return execute(text, params);
}

/** Initialize the database eagerly — useful on server boot. */
export function initDB(): void {
  getDB();
}

const sql = sqlTag as typeof sqlTag & { __raw: (text: string, params?: unknown[]) => Promise<unknown[]> };
sql.__raw = rawExec;

export default sql;
