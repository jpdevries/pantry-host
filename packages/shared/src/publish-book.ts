/**
 * Publish a kitchen as an EPUB: fetch it over GraphQL, download and
 * normalize its photos, draw a cover, and run pandoc on the Markdown from
 * ./export-book. Node only (child_process, fs). Shared by the CLI
 * (packages/app/scripts/publish-book.ts, used by the publish-kitchen skill)
 * and the MCP server's publish_kitchen_book tool.
 *
 * Needs pandoc 3+ and ImageMagick on the machine that runs it.
 */

import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { compareText } from './compare-text';
import { BOOK_QUERY, KITCHENS_QUERY, bookFileName, buildBook, type BookMenu, type BookRecipe } from './export-book';

export type BookPhotos = 'color' | 'gray' | 'none';

export interface PublishOptions {
  graphqlUrl: string;
  /** Second place `/uploads/` photos are looked for (Rex serves them when the GraphQL server is the Node one). */
  appUrl: string;
  photos: BookPhotos;
  /** Directory the finished EPUB is written to. */
  outDir: string;
  /** Keep pandoc's working directory instead of deleting it. */
  keepWorkdir?: boolean;
  log?: (message: string) => void;
}

export interface BookResult {
  kitchen: string;
  name: string;
  file: string;
  bytes: number;
  recipes: number;
  menus: number;
  photos: number;
  /** Recipes whose photo couldn't be used, and why (a broken link shows up here). */
  missingPhotos: { title: string; reason: string }[];
  /** Set when the working directory was kept. */
  workdir?: string;
}

const COVER_FONTS = [
  '/System/Library/Fonts/Supplemental/Georgia.ttf',
  '/usr/share/fonts/truetype/dejavu/DejaVuSerif.ttf',
  '/usr/share/fonts/dejavu/DejaVuSerif.ttf',
];

function run(cmd: string, cmdArgs: string[], cwd?: string): string {
  const r = spawnSync(cmd, cmdArgs, { cwd, encoding: 'utf8' });
  if (r.error) throw r.error;
  if (r.status !== 0) throw new Error(`${cmd} exited ${r.status}: ${(r.stderr || r.stdout).trim().slice(0, 500)}`);
  return r.stdout;
}

function has(cmd: string, versionArg: string): string | null {
  const r = spawnSync(cmd, [versionArg], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout : null;
}

/** Throws with the install command when pandoc 3+ (or ImageMagick, for photos) is missing. */
export function checkBookTools(photos: BookPhotos): { magick: boolean } {
  const pandoc = has('pandoc', '--version');
  if (!pandoc) throw new Error('pandoc is not installed. Install it with: brew install pandoc');
  const major = Number(/pandoc\S* (\d+)/.exec(pandoc)?.[1] ?? 0);
  if (major < 3) throw new Error(`pandoc 3 or newer is required (found ${pandoc.split('\n')[0]}). Upgrade with: brew upgrade pandoc`);
  const magick = has('magick', '-version') !== null;
  if (!magick && photos !== 'none') throw new Error('ImageMagick is not installed. Install it with: brew install imagemagick (or publish without photos)');
  return { magick };
}

async function gql<T>(url: string, query: string, variables?: Record<string, unknown>): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ query, variables }),
      signal: AbortSignal.timeout(30000),
    });
  } catch (e) {
    throw new Error(`can't reach the GraphQL server at ${url} (${(e as Error).message}). Set GRAPHQL_URL to the server that holds your kitchens.`);
  }
  const json = (await res.json()) as { data?: T; errors?: { message: string }[] };
  if (json.errors?.length) throw new Error(`GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
  if (!json.data) throw new Error(`GraphQL returned no data (HTTP ${res.status})`);
  return json.data;
}

export async function listBookKitchens(graphqlUrl: string): Promise<{ slug: string; name: string }[]> {
  const { kitchens } = await gql<{ kitchens: { slug: string; name: string }[] }>(graphqlUrl, KITCHENS_QUERY);
  return kitchens;
}

/** Where to try fetching a recipe photo from, best first. */
function photoCandidates(photoUrl: string, photos: BookPhotos, graphqlOrigin: string, appOrigin: string): string[] {
  if (photoUrl.startsWith('/uploads/')) {
    const base = photoUrl.replace(/\.[a-z0-9]+$/i, '');
    const variant = `${base}-800${photos === 'gray' ? '-gray' : ''}.jpg`;
    const origins = [...new Set([graphqlOrigin, appOrigin])];
    // Variants first (already 800px); the original covers uploads that never got them.
    return [...origins.map((o) => o + variant), ...origins.map((o) => o + photoUrl)];
  }
  // Protocol-relative ("//cdn.example.com/x.jpg") resolves to https, as in a browser.
  if (photoUrl.startsWith('//')) photoUrl = `https:${photoUrl}`;
  if (!/^https?:\/\//i.test(photoUrl)) return [];
  // TheCocktailDB serves sized copies; /large is 500px.
  if (photoUrl.includes('thecocktaildb.com/images/')) return [`${photoUrl}/large`, photoUrl];
  return [photoUrl];
}

/**
 * Identify a download by its first bytes. Naming the format to ImageMagick
 * keeps a mislabeled file away from its script-like coders (MVG, MSL, SVG),
 * and catches HTML error pages served as 200s.
 */
function sniffImage(bytes: Buffer): string | null {
  const ascii = (from: number, to: number) => bytes.subarray(from, to).toString('latin1');
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'jpeg';
  if (ascii(1, 4) === 'PNG') return 'png';
  if (ascii(0, 4) === 'GIF8') return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  return null;
}

/**
 * Download the first candidate that is an image and re-encode it as a small
 * JPEG with metadata stripped (no camera GPS in the book). Returns null on
 * success, otherwise why the last candidate failed.
 */
async function fetchPhoto(candidates: string[], dest: string, photos: BookPhotos): Promise<string | null> {
  let reason = 'no usable photo URL';
  for (const url of candidates) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(20000), headers: { 'user-agent': 'PantryHost-publish-book' } });
      if (!res.ok) {
        reason = `HTTP ${res.status}`;
        continue;
      }
      const bytes = Buffer.from(await res.arrayBuffer());
      const format = sniffImage(bytes);
      if (!format) {
        reason = `not an image (${res.headers.get('content-type') ?? 'no content type'})`;
        continue;
      }
      const raw = `${dest}.download`;
      writeFileSync(raw, bytes);
      const ops = ['-auto-orient', '-resize', '1000x1000>', '-strip', ...(photos === 'gray' ? ['-colorspace', 'Gray'] : []), '-quality', '80'];
      run('magick', [`${format}:${raw}[0]`, ...ops, `jpeg:${dest}`]);
      rmSync(raw, { force: true });
      return null;
    } catch (e) {
      reason = (e as Error).name === 'TimeoutError' ? 'timed out' : (e as Error).message.slice(0, 120);
    }
  }
  return reason;
}

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  const queue = [...items];
  await Promise.all(Array.from({ length: Math.min(size, queue.length) }, async () => {
    for (let item = queue.shift(); item !== undefined; item = queue.shift()) await fn(item);
  }));
}

/** 1600×2560 cover: a photo grid (6+ photos) or hero (1–5) above the title, or just the title. */
function drawCover(workdir: string, title: string, subtitle: string, photoFiles: string[]): string | null {
  const font = COVER_FONTS.find((f) => existsSync(f));
  if (!font) return null;
  const bg = '#231f1a';
  const ink = '#f4ede3';
  const top = join(workdir, 'cover-top.jpg');
  let topHeight = 0;
  if (photoFiles.length >= 6) {
    const tiles = photoFiles.slice(0, 6).map((f, n) => {
      const tile = join(workdir, `cover-tile-${n}.jpg`);
      run('magick', [f, '-resize', '534x534^', '-gravity', 'center', '-extent', '534x534', tile]);
      return tile;
    });
    run('magick', ['montage', '-font', font, ...tiles, '-tile', '3x2', '-geometry', '534x534+0+0', top]);
    topHeight = 1068;
  } else if (photoFiles.length > 0) {
    run('magick', [photoFiles[0], '-resize', '1600x1068^', '-gravity', 'center', '-extent', '1600x1068', top]);
    topHeight = 1068;
  }
  // caption: picks the point size that fits, so long kitchen names still fit.
  const titleImg = join(workdir, 'cover-title.png');
  const subImg = join(workdir, 'cover-subtitle.png');
  run('magick', ['-background', 'none', '-fill', ink, '-font', font, '-size', '1400x420', '-gravity', 'center', `caption:${title}`, titleImg]);
  run('magick', ['-background', 'none', '-fill', ink, '-font', font, '-size', '1400x110', '-gravity', 'center', `caption:${subtitle}`, subImg]);
  const cover = join(workdir, 'cover.jpg');
  const textTop = topHeight ? topHeight + 300 : 900;
  run('magick', [
    '-size', '1600x2560', `xc:${bg}`,
    ...(topHeight ? [top, '-geometry', '+0+0', '-composite'] : []),
    titleImg, '-geometry', `+100+${textTop}`, '-composite',
    subImg, '-geometry', `+100+${textTop + 520}`, '-composite',
    '-quality', '85', cover,
  ]);
  return cover;
}

/** Build one kitchen into `<outDir>/pantry-host-<slug>.epub`. Call checkBookTools first. */
export async function publishKitchenBook(slug: string, opts: PublishOptions): Promise<BookResult> {
  const log = opts.log ?? (() => {});
  const graphqlOrigin = new URL(opts.graphqlUrl).origin;
  const appOrigin = new URL(opts.appUrl).origin;
  const data = await gql<{ kitchen: { slug: string; name: string } | null; recipes: BookRecipe[]; menus: BookMenu[] }>(opts.graphqlUrl, BOOK_QUERY, { kitchenSlug: slug });
  if (!data.kitchen) throw new Error(`no kitchen with slug "${slug}"`);
  const { kitchen } = data;
  const activeMenus = data.menus.filter((m) => m.active).length;
  log(`${kitchen.name}: ${data.recipes.length} recipes, ${activeMenus} active menus`);

  const workdir = mkdtempSync(join(tmpdir(), `pantry-book-${kitchen.slug}-`));
  try {
    const images: Record<string, string> = {};
    const credits = new Set<string>();
    const missing: { title: string; reason: string }[] = [];
    if (opts.photos !== 'none') {
      mkdirSync(join(workdir, 'images'));
      await pool(data.recipes.filter((r) => r.photoUrl), 6, async (r) => {
        const rel = `images/${r.slug || r.id}.jpg`;
        const failure = await fetchPhoto(photoCandidates(r.photoUrl!, opts.photos, graphqlOrigin, appOrigin), join(workdir, rel), opts.photos);
        if (failure) {
          missing.push({ title: r.title, reason: failure });
          return;
        }
        images[r.id] = rel;
        const external = r.photoUrl!.startsWith('//') ? `https:${r.photoUrl}` : r.photoUrl!;
        if (/^https?:/i.test(external)) credits.add(new URL(external).hostname.replace(/^www\./, ''));
      });
      log(`${kitchen.name}: ${Object.keys(images).length} photos${missing.length ? `, ${missing.length} unavailable` : ''}`);
    }

    // Local date: the book should say the day you exported it, not UTC's.
    const now = new Date();
    const date = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const book = buildBook({ kitchen, recipes: data.recipes, menus: data.menus, images, photoCredits: [...credits], date });
    writeFileSync(join(workdir, 'book.md'), book.markdown);
    writeFileSync(join(workdir, 'meta.yaml'), book.metadata);
    writeFileSync(join(workdir, 'epub.css'), book.css);

    // Cover photos follow book order, so the cover only changes when the recipes do.
    const coverPhotos = book.recipes.filter((r) => images[r.id]).map((r) => join(workdir, images[r.id]));
    const cover = has('magick', '-version') ? drawCover(workdir, kitchen.name, book.subtitle, coverPhotos) : null;

    const name = bookFileName(kitchen.slug);
    const built = join(workdir, name);
    run('pandoc', [
      'book.md', '--from=markdown', '--to=epub3', '--metadata-file=meta.yaml',
      '--toc', `--toc-depth=${book.tocDepth}`, `--split-level=${book.splitLevel}`, '--css=epub.css',
      ...(cover ? [`--epub-cover-image=${cover}`] : []),
      '--resource-path=.', '-o', built,
    ], workdir);

    mkdirSync(opts.outDir, { recursive: true });
    const file = join(opts.outDir, name);
    copyFileSync(built, file);
    return {
      kitchen: kitchen.slug,
      name: kitchen.name,
      file,
      bytes: statSync(file).size,
      recipes: book.recipes.length,
      menus: activeMenus,
      photos: Object.keys(images).length,
      missingPhotos: missing.sort((a, b) => compareText(a.title, b.title)),
      ...(opts.keepWorkdir ? { workdir } : {}),
    };
  } finally {
    if (!opts.keepWorkdir) rmSync(workdir, { recursive: true, force: true });
  }
}

// ── Google Drive for desktop ────────────────────────────────────────────────

const DRIVE_ID_ATTR = 'com.google.drivefs.item-id#S';

function driveFolderId(idOrLink: string): string {
  const fromLink = /[?&]id=([\w-]{10,})/.exec(idOrLink) ?? /\/folders\/([\w-]{10,})/.exec(idOrLink);
  if (fromLink) return fromLink[1];
  if (/^[\w-]{10,}$/.test(idOrLink)) return idOrLink;
  throw new Error(`not a Google Drive folder link or ID: ${idOrLink}`);
}

function driveItemId(path: string): string | null {
  const r = spawnSync('xattr', ['-p', DRIVE_ID_ATTR, path], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

/** Find the Drive for desktop directory (macOS) whose item ID matches, breadth-first. */
export function resolveDriveFolder(idOrLink: string): string {
  const id = driveFolderId(idOrLink);
  const cloud = join(homedir(), 'Library', 'CloudStorage');
  const roots = existsSync(cloud) ? readdirSync(cloud).filter((n) => n.startsWith('GoogleDrive-')).map((n) => join(cloud, n)) : [];
  if (!roots.length) throw new Error('No Google Drive for desktop folder found under ~/Library/CloudStorage. Install Drive for desktop, or pass --out with a synced folder.');
  let level = roots.flatMap((r) => readdirSync(r, { withFileTypes: true }).filter((d) => d.isDirectory() && !d.name.startsWith('.')).map((d) => join(r, d.name)));
  for (let depth = 0; depth < 8 && level.length; depth++) {
    const next: string[] = [];
    for (const dir of level) {
      if (driveItemId(dir) === id) return dir;
      try {
        for (const d of readdirSync(dir, { withFileTypes: true })) {
          if (d.isDirectory() && !d.name.startsWith('.')) next.push(join(dir, d.name));
        }
      } catch {
        // Unreadable folder; skip it.
      }
    }
    level = next;
  }
  throw new Error(`Drive folder ${id} isn't in your Drive for desktop sync folders (${roots.join(', ')}).`);
}

/**
 * Copy into the synced folder and wait (up to 60s) for Drive to assign the
 * file an ID. Overwriting keeps the existing ID, so for a replaced file the ID
 * is there at once while the upload of the new bytes can lag behind.
 */
export async function copyToDrive(file: string, folder: string): Promise<{ path: string; fileId: string | null; replaced: boolean }> {
  const dest = join(folder, file.split('/').pop()!);
  const replaced = existsSync(dest);
  copyFileSync(file, dest);
  for (let i = 0; i < 40; i++) {
    const id = driveItemId(dest);
    if (id && !id.startsWith('local')) return { path: dest, fileId: id, replaced };
    await new Promise((r) => setTimeout(r, 1500));
  }
  return { path: dest, fileId: null, replaced };
}
