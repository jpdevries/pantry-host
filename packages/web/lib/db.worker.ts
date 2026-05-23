/**
 * Web Worker for SQLite-WASM + OPFS-SAH-Pool persistence.
 *
 * The OPFS SyncAccessHandle Pool VFS calls `createSyncAccessHandle()` on
 * FileSystemFileHandle objects. Chrome only exposes that method on the
 * main thread when the page is `crossOriginIsolated` (i.e. COOP/COEP headers
 * are set AND not broken by browser extensions). Inside a dedicated Web
 * Worker the method is unconditionally available — no COOP/COEP, no
 * extension interference.
 *
 * Mirrors the pattern in lib/parse-worker.ts:
 *   main thread sends { id, op, sql?, bind? }
 *   worker replies { id, ok, result?, mode?, error? }
 *
 * The main thread (lib/db.ts) keeps the same tagged-template `sql` API its
 * callers (GraphQL resolvers in lib/schema/index.ts) already use; only the
 * transport changes.
 */

import sqlite3InitModule, { type Database, type Sqlite3Static } from '@sqlite.org/sqlite-wasm';
import { SCHEMA_SQL } from '@pantry-host/shared/sql/schema';

export type DbOp = 'init' | 'query' | 'exec';
export type DbReq = { id: number; op: DbOp; sql?: string; bind?: unknown[] };
export type DbRes =
  | { id: number; ok: true; result: unknown[]; mode?: 'opfs-sah-pool' | 'memory'; sahErr?: string }
  | { id: number; ok: false; error: string };

let _db: Database | null = null;
let _initPromise: Promise<Database> | null = null;
let _mode: 'opfs-sah-pool' | 'memory' = 'memory';
let _sahErr: string | undefined;

async function openDB(): Promise<Database> {
  if (_db) return _db;
  if (_initPromise) return _initPromise;

  _initPromise = (async () => {
    const sqlite3 = (await sqlite3InitModule({
      print: () => {},
      printErr: (...args: unknown[]) => self.postMessage({ id: -1, ok: false, error: `[sqlite] ${args.join(' ')}` }),
    })) as Sqlite3Static;

    let db: Database;
    try {
      // SAH-Pool VFS in a Worker: createSyncAccessHandle is unconditionally
      // available here, so no COOP/COEP gymnastics required.
      const poolUtil = await (sqlite3 as any).installOpfsSAHPoolVfs({
        name: 'pantryhost',
        // Tear down a previously-installed pool whose handles are still
        // open (e.g. a tab that crashed mid-init or an HMR reload that
        // left orphan SAH handles). Without this, repeated init attempts
        // hit "Access Handles cannot be created if there is another open
        // Access Handle" and the VFS install fails forever.
        forceReinitIfNeeded: true,
      });
      db = new poolUtil.OpfsSAHPoolDb('/pantryhost.db') as Database;
      _mode = 'opfs-sah-pool';
    } catch (err) {
      // Last-resort fallback for environments that lack OPFS entirely
      // (Safari private mode, sandboxed embeds, etc.). Data won't persist
      // across tab closes here; the main thread should surface this state
      // to the user.
      _sahErr = (err as Error)?.message ?? String(err);
      // eslint-disable-next-line no-console
      console.warn('[db.worker] OPFS-SAH-Pool unavailable, falling back to in-memory:', err);
      db = new (sqlite3 as any).oo1.DB(':memory:', 'c') as Database;
      _mode = 'memory';
    }

    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');
    db.exec(SCHEMA_SQL);

    _db = db;
    return db;
  })();

  return _initPromise;
}

self.onmessage = async (e: MessageEvent<DbReq>) => {
  const { id, op, sql, bind } = e.data;
  try {
    const db = await openDB();
    if (op === 'init') {
      const res: DbRes = { id, ok: true, result: [], mode: _mode, sahErr: _sahErr };
      self.postMessage(res);
      return;
    }
    if (op === 'query') {
      const rows = (db as any).selectObjects(sql, bind ?? []) as unknown[];
      const res: DbRes = { id, ok: true, result: rows, mode: _mode };
      self.postMessage(res);
      return;
    }
    if (op === 'exec') {
      db.exec({ sql: sql!, bind: bind ?? [] });
      const res: DbRes = { id, ok: true, result: [], mode: _mode };
      self.postMessage(res);
      return;
    }
    const res: DbRes = { id, ok: false, error: `unknown op: ${op}` };
    self.postMessage(res);
  } catch (err) {
    const msg = (err as Error).message;
    const res: DbRes = { id, ok: false, error: `${msg}\n  in: ${sql}\n  params: ${JSON.stringify(bind)}` };
    self.postMessage(res);
  }
};
