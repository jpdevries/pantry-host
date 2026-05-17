/**
 * Browser SQLite adapter backed by @sqlite.org/sqlite-wasm with the
 * OPFS-SAH-Pool VFS for persistence. Runs on the main thread (SAH-Pool
 * does not need a Worker or COOP/COEP). Falls back to in-memory if OPFS
 * is unavailable (incognito/Safari private).
 *
 * The exported `sql` matches the app's tagged-template wrapper API so the
 * GraphQL resolvers in lib/schema/index.ts compile unchanged.
 */
import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { SCHEMA_SQL } from '@pantry-host/shared/sql/schema';

let _db: Database | null = null;
let _initPromise: Promise<Database> | null = null;

async function openDB(): Promise<Database> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const sqlite3 = (await sqlite3InitModule({ print: () => {}, printErr: console.error })) as Sqlite3Static;

    let db: Database;
    try {
      const poolUtil = await (sqlite3 as any).installOpfsSAHPoolVfs({ name: 'pantryhost' });
      db = new poolUtil.OpfsSAHPoolDb('/pantryhost.db') as Database;
    } catch (err) {
      console.warn('[db] OPFS-SAH-Pool unavailable, falling back to in-memory:', err);
      db = new (sqlite3 as any).oo1.DB(':memory:', 'c') as Database;
    }

    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec(SCHEMA_SQL);

    _db = db;
    return db;
  })();

  return _initPromise;
}

const RETURNS_ROWS = /^\s*(select|with|pragma)\b|\breturning\b/i;

async function execute(text: string, params: unknown[]): Promise<unknown[]> {
  const db = await openDB();
  const bind = params.map((v) => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return v.toISOString();
    return v as null | number | string;
  });
  if (RETURNS_ROWS.test(text)) {
    try {
      return (db as any).selectObjects(text, bind) as unknown[];
    } catch (err) {
      const e = err as Error;
      e.message = `${e.message}\n  in: ${text}\n  params: ${JSON.stringify(bind)}`;
      throw e;
    }
  }
  try {
    db.exec({ sql: text, bind });
  } catch (err) {
    const e = err as Error;
    e.message = `${e.message}\n  in: ${text}\n  params: ${JSON.stringify(bind)}`;
    throw e;
  }
  return [];
}

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
  const text = `INSERT INTO ${table} (${cols.join(',')}) VALUES ${placeholders} RETURNING *`;
  return execute(text, params) as Promise<T[]>;
}

const sql = sqlTag as typeof sqlTag;
export default sql;

/** Initialize the database eagerly. Safe to call multiple times. */
export async function initDB(): Promise<void> {
  await openDB();
}

/** Raw DB handle for tooling that needs to issue ad-hoc statements (export). */
export async function getRawDB(): Promise<Database> {
  return openDB();
}
