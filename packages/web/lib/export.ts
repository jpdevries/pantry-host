/**
 * Data export — SQL dump + images zip.
 *
 * Generates a downloadable SQLite-flavored backup of the user's data.
 * Array/object columns (tags, aliases, step_photos, product_meta) are
 * stored as JSON text and dumped verbatim.
 */

import { getRawDB } from '@/lib/db';

const TABLES = [
  'kitchens',
  'ingredients',
  'recipes',
  'recipe_ingredients',
  'recipe_cookware',
  'cookware',
  'menus',
  'menu_recipes',
] as const;

/** Generate SQL INSERT statements for all data */
export async function generateSQLDump(): Promise<string> {
  const db = await getRawDB();
  const lines: string[] = [
    '-- Pantry Host data export',
    `-- Generated: ${new Date().toISOString()}`,
    '',
  ];

  for (const table of TABLES) {
    const rows = (db as any).selectObjects(`SELECT * FROM ${table}`) as Record<string, unknown>[];
    if (rows.length === 0) continue;

    lines.push(`-- ${table}`);
    for (const row of rows) {
      const cols = Object.keys(row);
      const vals = cols.map((col) => {
        const v = row[col];
        if (v === null || v === undefined) return 'NULL';
        if (typeof v === 'number') return String(v);
        if (typeof v === 'bigint') return v.toString();
        return `'${String(v).replace(/'/g, "''")}'`;
      });
      lines.push(`INSERT INTO ${table} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

/** Download SQL dump as a file */
export async function downloadSQLDump(): Promise<void> {
  const sql = await generateSQLDump();
  const blob = new Blob([sql], { type: 'text/sql' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pantryhost-backup-${new Date().toISOString().split('T')[0]}.sql`;
  a.click();
  URL.revokeObjectURL(url);
}

/** Download full backup (SQL + images) as zip — requires JSZip or similar */
export async function downloadFullBackup(): Promise<void> {
  // For now, just download the SQL dump
  // TODO: Add JSZip for images when needed
  await downloadSQLDump();
}
