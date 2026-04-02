/**
 * PGlite database adapter that mimics the postgres.js tagged template API.
 *
 * The app's GraphQL schema uses `sql` as a tagged template literal:
 *   sql`SELECT * FROM foo WHERE id = ${id}`
 *
 * It also uses two special forms:
 *   sql.array(items)     — converts JS array to PostgreSQL array literal
 *   sql(rows, ...cols)   — generates bulk INSERT fragment
 *
 * This module wraps PGlite to provide the same API so the schema resolvers
 * work unmodified in the browser.
 */

import { PGlite } from '@electric-sql/pglite';

let db: PGlite | null = null;
let initPromise: Promise<void> | null = null;

// Schema SQL is inlined at build time — see initDB()
const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS kitchens (
  id          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  slug        TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

INSERT INTO kitchens (slug, name) VALUES ('home', 'Home') ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS ingredients (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name           VARCHAR(255) NOT NULL,
  category       VARCHAR(100),
  quantity       DECIMAL,
  unit           VARCHAR(50),
  always_on_hand BOOLEAN NOT NULL DEFAULT false,
  tags           TEXT[] DEFAULT '{}',
  kitchen_id     TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ingredients_tags ON ingredients USING GIN(tags);

CREATE TABLE IF NOT EXISTS recipes (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title             VARCHAR(255) NOT NULL,
  slug              VARCHAR(255),
  description       TEXT,
  instructions      TEXT NOT NULL,
  servings          INTEGER DEFAULT 2,
  prep_time         INTEGER,
  cook_time         INTEGER,
  tags              TEXT[] DEFAULT '{}',
  required_cookware TEXT[] DEFAULT '{}',
  source            VARCHAR(20) DEFAULT 'manual',
  source_url        TEXT,
  photo_url         TEXT,
  last_made_at      TIMESTAMPTZ,
  queued            BOOLEAN DEFAULT FALSE,
  kitchen_id        TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_recipes_tags ON recipes USING GIN(tags);
CREATE INDEX IF NOT EXISTS idx_recipes_cookware ON recipes USING GIN(required_cookware);

CREATE TABLE IF NOT EXISTS cookware (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  brand       VARCHAR(255),
  tags        TEXT[] DEFAULT '{}',
  kitchen_id  TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  notes       TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_cookware_tags ON cookware USING GIN(tags);

CREATE TABLE IF NOT EXISTS recipe_cookware (
  recipe_id   UUID NOT NULL REFERENCES recipes(id)  ON DELETE CASCADE,
  cookware_id UUID NOT NULL REFERENCES cookware(id) ON DELETE CASCADE,
  PRIMARY KEY (recipe_id, cookware_id)
);
CREATE INDEX IF NOT EXISTS idx_recipe_cookware_recipe   ON recipe_cookware(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_cookware_cookware ON recipe_cookware(cookware_id);

CREATE TABLE IF NOT EXISTS recipe_ingredients (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id        UUID REFERENCES recipes(id) ON DELETE CASCADE,
  ingredient_name  VARCHAR(255) NOT NULL,
  quantity         DECIMAL,
  unit             VARCHAR(50),
  source_recipe_id UUID REFERENCES recipes(id) ON DELETE SET NULL,
  sort_order       INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS menus (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       VARCHAR(255) NOT NULL,
  slug        VARCHAR(255) UNIQUE,
  description TEXT,
  active      BOOLEAN DEFAULT TRUE,
  category    VARCHAR(50),
  kitchen_id  TEXT NOT NULL REFERENCES kitchens(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_menus_kitchen ON menus(kitchen_id);

CREATE TABLE IF NOT EXISTS menu_recipes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_id    UUID NOT NULL REFERENCES menus(id) ON DELETE CASCADE,
  recipe_id  UUID NOT NULL REFERENCES recipes(id) ON DELETE CASCADE,
  course     VARCHAR(50),
  sort_order INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_menu_recipes_menu ON menu_recipes(menu_id);
`;

async function getDB(): Promise<PGlite> {
  if (db) return db;
  if (initPromise) {
    await initPromise;
    return db!;
  }

  initPromise = (async () => {
    db = new PGlite('idb://pantryhost');
    await db.waitReady;

    // Check if schema already exists
    const result = await db.query(
      `SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'kitchens') as exists`
    );
    const exists = (result.rows[0] as { exists: boolean }).exists;

    if (!exists) {
      // Split and execute schema statements individually
      const statements = SCHEMA_SQL
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      for (const stmt of statements) {
        await db.query(stmt + ';');
      }
    } else {
      // Ensure home kitchen exists
      await db.query(
        `INSERT INTO kitchens (slug, name) VALUES ('home', 'Home') ON CONFLICT (slug) DO NOTHING`
      );
      // Migrations for existing databases
      await db.query(`ALTER TABLE cookware ADD COLUMN IF NOT EXISTS notes TEXT`);
      await db.query(`CREATE TABLE IF NOT EXISTS recipe_cookware (
        recipe_id   UUID NOT NULL REFERENCES recipes(id)  ON DELETE CASCADE,
        cookware_id UUID NOT NULL REFERENCES cookware(id) ON DELETE CASCADE,
        PRIMARY KEY (recipe_id, cookware_id)
      )`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_recipe_cookware_recipe   ON recipe_cookware(recipe_id)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_recipe_cookware_cookware ON recipe_cookware(cookware_id)`);
    }
  })();

  await initPromise;
  return db!;
}

/** Marker class for sql.array() results */
class PgArray {
  constructor(public items: unknown[]) {}
}

/** Marker class for sql(rows, ...cols) bulk insert results */
class PgBulkInsert {
  constructor(public rows: Record<string, unknown>[], public columns: string[]) {}
}

/**
 * Tagged template literal that mimics postgres.js sql`...` API.
 * Converts template + interpolated values into a parameterized query.
 */
function sqlTag(strings: TemplateStringsArray, ...values: unknown[]): Promise<unknown[]> & { text: string; values: unknown[] } {
  let queryParts: string[] = [];
  let params: unknown[] = [];
  let paramIdx = 1;

  for (let i = 0; i < strings.length; i++) {
    queryParts.push(strings[i]);

    if (i < values.length) {
      const val = values[i];

      if (val instanceof PgArray) {
        // sql.array([...]) → ARRAY[$1, $2, ...]
        if (val.items.length === 0) {
          queryParts.push("'{}'::text[]");
        } else {
          const placeholders = val.items.map((item) => {
            params.push(item);
            return `$${paramIdx++}`;
          });
          queryParts.push(`ARRAY[${placeholders.join(', ')}]`);
        }
      } else if (val instanceof PgBulkInsert) {
        // sql(rows, ...cols) → (col1, col2) VALUES ($1, $2), ($3, $4)
        const cols = val.columns;
        const rowPlaceholders = val.rows.map((row) => {
          const ph = cols.map((col) => {
            const v = row[col];
            if (Array.isArray(v)) {
              // Array columns need ARRAY[] syntax
              if (v.length === 0) {
                return "'{}'::text[]";
              }
              const arrPh = v.map((item) => {
                params.push(item);
                return `$${paramIdx++}`;
              });
              return `ARRAY[${arrPh.join(', ')}]`;
            }
            params.push(v);
            return `$${paramIdx++}`;
          });
          return `(${ph.join(', ')})`;
        });
        queryParts.push(`(${cols.join(', ')}) VALUES ${rowPlaceholders.join(', ')}`);
      } else if (val === null || val === undefined) {
        params.push(null);
        queryParts.push(`$${paramIdx++}`);
      } else {
        params.push(val);
        queryParts.push(`$${paramIdx++}`);
      }
    }
  }

  const text = queryParts.join('');

  // Create a promise that auto-executes the query
  const promise = getDB().then(async (db) => {
    const result = await db.query(text, params);
    return result.rows as unknown[];
  }) as Promise<unknown[]> & { text: string; values: unknown[] };

  // Attach query info for debugging
  promise.text = text;
  promise.values = params;

  return promise;
}

/**
 * sql.array(items) — converts a JS array to a Postgres array parameter.
 */
sqlTag.array = function (items: unknown[]): PgArray {
  return new PgArray(items ?? []);
};

/**
 * sql(rows, ...columns) — generates a bulk INSERT fragment.
 * Used as: sql`INSERT INTO foo ${sql(rows, 'col1', 'col2')}`
 */
function sqlCallable(rows: Record<string, unknown>[], ...columns: string[]): PgBulkInsert {
  return new PgBulkInsert(rows, columns);
}

// Merge the tagged template and callable forms
const sql = Object.assign(
  function (stringsOrRows: TemplateStringsArray | Record<string, unknown>[], ...rest: unknown[]) {
    if (Array.isArray(stringsOrRows) && 'raw' in stringsOrRows) {
      // Tagged template: sql`...`
      return sqlTag(stringsOrRows as TemplateStringsArray, ...rest);
    }
    // Callable: sql(rows, ...columns)
    return sqlCallable(stringsOrRows as Record<string, unknown>[], ...(rest as string[]));
  },
  { array: sqlTag.array },
);

export default sql;

/** Initialize the database (call early to start loading) */
export async function initDB(): Promise<void> {
  await getDB();
}

/** Get raw PGlite instance for advanced operations */
export async function getRawDB(): Promise<PGlite> {
  return getDB();
}
