/**
 * Browser SQLite adapter — main-thread proxy to a Web Worker that owns
 * the @sqlite.org/sqlite-wasm instance and the OPFS-SAH-Pool VFS.
 *
 * Why the worker:
 *   The SAH-Pool VFS calls `FileSystemFileHandle.createSyncAccessHandle()`.
 *   On the main thread in current Chrome, that method is only exposed when
 *   the document is `crossOriginIsolated` (i.e. COOP/COEP headers set, and
 *   not broken by content-script-injecting browser extensions). Inside a
 *   dedicated Web Worker the method is unconditionally available, so OPFS
 *   persistence works without COOP/COEP gymnastics. See lib/db.worker.ts
 *   for the worker-side impl.
 *
 * The exported `sql` tagged-template API is unchanged from the previous
 * in-line implementation — the GraphQL resolvers in lib/schema/index.ts
 * compile and run unmodified.
 */

import type { DbReq, DbRes } from './db.worker';

let _worker: Worker | null = null;
let _initPromise: Promise<void> | null = null;
let _mode: 'opfs-sah-pool' | 'memory' | null = null;
let _sahErr: string | undefined;
let _nextId = 1;
const _pending = new Map<number, { resolve: (rows: unknown[]) => void; reject: (err: Error) => void }>();

function getWorker(): Worker {
  if (_worker) return _worker;
  const w = new Worker(new URL('./db.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<DbRes>) => {
    const { id } = e.data;
    if (id < 0) {
      // Diagnostic from inside the worker (e.g. sqlite printErr) — log
      // and move on; not associated with a pending request.
      if (!e.data.ok) console.error(e.data.error);
      return;
    }
    const p = _pending.get(id);
    if (!p) return;
    _pending.delete(id);
    if (e.data.ok) {
      if (e.data.mode) _mode = e.data.mode;
      if (e.data.sahErr) _sahErr = e.data.sahErr;
      p.resolve(e.data.result);
    } else {
      p.reject(new Error(e.data.error));
    }
  };
  w.onerror = (e) => {
    console.error('[db] worker error:', e.message || e);
    for (const p of _pending.values()) p.reject(new Error(e.message || 'db worker error'));
    _pending.clear();
  };
  _worker = w;
  return w;
}

function send(op: 'init' | 'query' | 'exec', sql?: string, bind?: unknown[]): Promise<unknown[]> {
  const w = getWorker();
  const id = _nextId++;
  return new Promise((resolve, reject) => {
    _pending.set(id, { resolve, reject });
    const req: DbReq = { id, op, sql, bind };
    w.postMessage(req);
  });
}

const RETURNS_ROWS = /^\s*(select|with|pragma)\b|\breturning\b/i;

function coerceBind(params: unknown[]): unknown[] {
  return params.map((v) => {
    if (v === undefined) return null;
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v instanceof Date) return v.toISOString();
    return v as null | number | string;
  });
}

async function execute(text: string, params: unknown[]): Promise<unknown[]> {
  const bind = coerceBind(params);
  const op = RETURNS_ROWS.test(text) ? 'query' : 'exec';
  return send(op, text, bind);
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

/** Initialize the DB worker eagerly. Safe to call multiple times. */
export async function initDB(): Promise<void> {
  if (!_initPromise) {
    _initPromise = send('init').then(() => undefined);
  }
  await _initPromise;
}

/**
 * Returns the current persistence mode after init completes. `'memory'`
 * means data will be lost on tab close — surface this to the user so they
 * know to export their data or switch browsers. Returns `null` before init.
 */
export function getPersistenceMode(): 'opfs-sah-pool' | 'memory' | null {
  return _mode;
}

/** SAH-Pool init error, if it fell back to in-memory. For diagnostics. */
export function getPersistenceError(): string | undefined {
  return _sahErr;
}

/**
 * Raw DB handle for ad-hoc statements (lib/export.ts SQL dump). The
 * worker-backed proxy exposes only `selectObjects` — everything else
 * should go through the tagged-template `sql` API.
 */
export async function getRawDB(): Promise<{ selectObjects: (sql: string, bind?: unknown[]) => Promise<unknown[]> }> {
  await initDB();
  return {
    selectObjects: (sql: string, bind: unknown[] = []) => send('query', sql, bind),
  };
}
