/**
 * Publish kitchens as EPUBs from the command line: the engine behind the
 * publish-kitchen skill (.claude/skills/publish-kitchen/SKILL.md). The work
 * itself lives in @pantry-host/shared/publish-book, which the MCP server's
 * publish_kitchen_book tool uses too.
 *
 * Books land in <repo>/exports/ and, with --drive-folder, are copied into
 * that folder's Google Drive for desktop sync directory, so Drive uploads the
 * file from disk.
 *
 * Usage:
 *   npx tsx packages/app/scripts/publish-book.ts --list
 *   npx tsx packages/app/scripts/publish-book.ts --kitchen bar [--kitchen home] [--all]
 *     [--photos color|gray|none] [--out <dir>] [--drive-folder <id or link>] [--keep]
 *
 * Needs pandoc 3+ and ImageMagick (`brew install pandoc imagemagick`).
 * GRAPHQL_URL (default http://localhost:4001/graphql) and APP_URL (default
 * http://localhost:3000, the second place /uploads/ photos are looked for)
 * are read from the environment or the repo-root .env.local.
 *
 * Progress goes to stderr; stdout gets one JSON summary.
 */

import { existsSync } from 'fs';
import { join, resolve } from 'path';
import {
  checkBookTools,
  copyToDrive,
  listBookKitchens,
  publishKitchenBook,
  resolveDriveFolder,
  type BookPhotos,
  type BookResult,
} from '@pantry-host/shared/publish-book';

const REPO_ROOT = resolve(__dirname, '..', '..', '..');

interface Args {
  list: boolean;
  all: boolean;
  kitchens: string[];
  photos: BookPhotos;
  out: string;
  driveFolder: string | null;
  keep: boolean;
}

const log = (...parts: unknown[]) => console.error('[publish-book]', ...parts);

function parseArgs(argv: string[]): Args {
  const args: Args = { list: false, all: false, kitchens: [], photos: 'color', out: join(REPO_ROOT, 'exports'), driveFolder: null, keep: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const value = () => {
      const v = argv[++i];
      if (!v) throw new Error(`${a} needs a value`);
      return v;
    };
    if (a === '--list') args.list = true;
    else if (a === '--all') args.all = true;
    else if (a === '--kitchen') args.kitchens.push(value());
    else if (a === '--photos') {
      const v = value();
      if (v !== 'color' && v !== 'gray' && v !== 'none') throw new Error(`--photos must be color, gray or none (got ${v})`);
      args.photos = v;
    } else if (a === '--out') args.out = resolve(value());
    else if (a === '--drive-folder') args.driveFolder = value();
    else if (a === '--keep') args.keep = true;
    else throw new Error(`unknown argument: ${a}`);
  }
  return args;
}

function loadEnvLocal(): void {
  const file = join(REPO_ROOT, '.env.local');
  if (!existsSync(file)) return;
  try {
    // Doesn't override variables that are already set.
    process.loadEnvFile(file);
  } catch (e) {
    log(`couldn't read .env.local: ${(e as Error).message}`);
  }
}

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));
  loadEnvLocal();
  const graphql = process.env.GRAPHQL_URL ?? 'http://localhost:4001/graphql';

  if (args.list) {
    console.log(JSON.stringify({ graphql, kitchens: await listBookKitchens(graphql) }, null, 2));
    return;
  }

  checkBookTools(args.photos);
  let slugs = args.kitchens;
  if (args.all) slugs = (await listBookKitchens(graphql)).map((k) => k.slug);
  if (!slugs.length) throw new Error('pass --kitchen <slug> (repeatable), --all, or --list');

  const driveDir = args.driveFolder ? resolveDriveFolder(args.driveFolder) : null;
  if (driveDir) log(`Drive folder: ${driveDir}`);

  const books: (BookResult & { drive?: { path: string; fileId: string | null; replaced: boolean } })[] = [];
  for (const slug of [...new Set(slugs)]) {
    const book = await publishKitchenBook(slug, {
      graphqlUrl: graphql,
      appUrl: process.env.APP_URL ?? 'http://localhost:3000',
      photos: args.photos,
      outDir: args.out,
      keepWorkdir: args.keep,
      log: (m) => log(m),
    });
    if (book.workdir) log(`${book.name}: working files kept in ${book.workdir}`);
    if (driveDir) {
      const drive = await copyToDrive(book.file, driveDir);
      log(`${book.name}: copied to ${drive.path}${drive.fileId ? '' : ' (Drive hasn\'t assigned an ID yet)'}`);
      books.push({ ...book, drive });
    } else {
      books.push(book);
    }
  }
  console.log(JSON.stringify({ graphql, books }, null, 2));
}

main().catch((e) => {
  log((e as Error).message);
  process.exit(1);
});
