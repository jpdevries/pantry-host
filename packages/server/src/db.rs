use anyhow::Context;
use r2d2_sqlite::SqliteConnectionManager;
use rusqlite::Connection;

/// Connection-pool type used by every resolver in this crate.
pub type Pool = r2d2::Pool<SqliteConnectionManager>;

/// Canonical schema, kept in lock-step with `packages/shared/src/sql/schema.ts`
/// (the TS source of truth for the Node and browser SQLite consumers).
///
/// `schema.sql` is the file copy maintained here; `include_str!` embeds it at
/// compile time so the Rust binary has zero filesystem dependencies at boot.
const SCHEMA_SQL: &str =
    include_str!("../../shared/src/sql/schema.sql");

/// Columns added after their table first shipped. `schema.sql` is
/// `CREATE TABLE IF NOT EXISTS` only, so it never adds a column to an
/// existing table; this list (shared with the TS runtimes via
/// `packages/shared/src/sql/migrations.ts`) is applied right after it.
const MIGRATIONS_JSON: &str =
    include_str!("../../shared/src/sql/migrations.json");

#[derive(serde::Deserialize)]
struct ColumnMigration {
    table: String,
    column: String,
    ddl: String,
}

/// Apply the schema, then every column migration whose column is missing.
/// SQLite's `ALTER TABLE … ADD COLUMN` has no `IF NOT EXISTS`, so each one
/// is guarded by a `pragma_table_info` lookup.
pub fn apply_schema(conn: &Connection) -> anyhow::Result<()> {
    conn.execute_batch(SCHEMA_SQL)
        .context("failed to apply schema")?;
    let migrations: Vec<ColumnMigration> =
        serde_json::from_str(MIGRATIONS_JSON).context("failed to parse migrations.json")?;
    for m in migrations {
        let mut stmt = conn.prepare("SELECT name FROM pragma_table_info(?1)")?;
        let has_column = stmt
            .query_map([&m.table], |r| r.get::<_, String>(0))?
            .filter_map(Result::ok)
            .any(|name| name.eq_ignore_ascii_case(&m.column));
        if !has_column {
            conn.execute_batch(&m.ddl)
                .with_context(|| format!("failed to add column {}.{}", m.table, m.column))?;
        }
    }
    Ok(())
}

/// Initialize the SQLite database at `path`, apply pragmas + schema, and
/// return a connection pool sized for an IoT-class device.
pub fn init(path: &str) -> anyhow::Result<Pool> {
    // `journal_mode = WAL` is a database-level setting that persists, so it
    // only needs to be set once on a single connection. Setting it from every
    // pooled connection in parallel races for the database lock — those
    // `database is locked` warnings are harmless but noisy.
    {
        let bootstrap = rusqlite::Connection::open(path)
            .context("failed to open SQLite database for bootstrap")?;
        bootstrap
            .execute_batch(
                "PRAGMA journal_mode = WAL;\
                 PRAGMA foreign_keys = ON;\
                 PRAGMA busy_timeout = 5000;",
            )
            .context("failed to apply boot pragmas")?;
        apply_schema(&bootstrap)?;
    }

    // `foreign_keys` is per-connection — set it on every pooled connection.
    let manager = SqliteConnectionManager::file(path).with_init(|conn| {
        conn.execute_batch("PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;")
    });
    let pool = r2d2::Pool::builder()
        .max_size(4)
        .build(manager)
        .context("failed to build SQLite connection pool")?;
    Ok(pool)
}

/// Run a closure that needs a pooled SQLite connection on a blocking-friendly
/// thread. async-graphql resolvers stay `async`; rusqlite stays sync.
pub async fn with_conn<F, T>(pool: &Pool, f: F) -> async_graphql::Result<T>
where
    F: FnOnce(&mut Connection) -> rusqlite::Result<T> + Send + 'static,
    T: Send + 'static,
{
    let pool = pool.clone();
    tokio::task::spawn_blocking(move || {
        let mut conn = pool
            .get()
            .map_err(|e| async_graphql::Error::new(format!("db pool: {e}")))?;
        f(&mut conn).map_err(|e| async_graphql::Error::new(e.to_string()))
    })
    .await
    .map_err(|e| async_graphql::Error::new(format!("db task join: {e}")))?
}

/// Generate an ISO-8601 UTC timestamp matching the format SQLite emits via
/// `strftime('%Y-%m-%dT%H:%M:%fZ','now')`. Used everywhere we set `updated_at`
/// or `last_made_at` from application code.
pub fn now_iso() -> String {
    chrono::Utc::now().format("%Y-%m-%dT%H:%M:%S%.3fZ").to_string()
}

/// New UUID v4 in lowercase hex form, matching `crypto.randomUUID()` output.
pub fn new_id() -> String {
    uuid::Uuid::new_v4().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn columns(conn: &Connection, table: &str) -> Vec<String> {
        let mut stmt = conn.prepare("SELECT name FROM pragma_table_info(?1)").unwrap();
        stmt.query_map([table], |r| r.get::<_, String>(0))
            .unwrap()
            .filter_map(Result::ok)
            .collect()
    }

    #[test]
    fn adds_missing_columns_to_a_pre_existing_table() {
        let conn = Connection::open_in_memory().unwrap();
        // The ingredients table as it shipped before expires_at/stocked_at.
        conn.execute_batch(
            "CREATE TABLE kitchens (id TEXT PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
               created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));
             CREATE TABLE ingredients (
               id TEXT PRIMARY KEY, name TEXT NOT NULL, category TEXT, quantity REAL, unit TEXT,
               item_size REAL, item_size_unit TEXT, always_on_hand INTEGER NOT NULL DEFAULT 0,
               tags TEXT NOT NULL DEFAULT '[]', aliases TEXT, barcode TEXT, product_meta TEXT,
               kitchen_id TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
               created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
               updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')));",
        )
        .unwrap();
        assert!(!columns(&conn, "ingredients").contains(&"expires_at".to_string()));

        apply_schema(&conn).unwrap();
        let cols = columns(&conn, "ingredients");
        assert!(cols.contains(&"expires_at".to_string()));
        assert!(cols.contains(&"stocked_at".to_string()));

        // Idempotent: a second pass finds nothing to add and doesn't fail.
        apply_schema(&conn).unwrap();
    }

    #[test]
    fn fresh_database_needs_no_migration() {
        let conn = Connection::open_in_memory().unwrap();
        apply_schema(&conn).unwrap();
        let cols = columns(&conn, "ingredients");
        assert!(cols.contains(&"expires_at".to_string()));
        assert!(cols.contains(&"stocked_at".to_string()));
    }
}
