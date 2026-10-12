import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { transformSync, type TransformOptions } from 'esbuild';

// packages/app/scripts/build-legacy.ts lowers every Rex client bundle for the
// Kindle's Silk browser. Run it on a copy of the embedded client build (the
// harness guarantees packages/server/static/client is populated) and check
// what Silk would choke on is gone.
const REPO = join(import.meta.dirname, '../..');
const SOURCE = join(REPO, 'packages/server/static/client');
const SCRIPT = join(REPO, 'packages/app/scripts/build-legacy.ts');

// Syntax Silk rejects: `?.` and `??` (despite its Chromium 80 UA; an on-device
// probe puts its engine at about Chromium 75) and everything newer that shows
// up in the bundles.
const FORBIDDEN = [
  'optional-chain',
  'nullish-coalescing',
  'logical-assignment',
  'class-private-method',
  'class-private-accessor',
  'class-private-static-method',
  'class-private-static-accessor',
  'class-private-brand-check',
  'class-static-blocks',
  'top-level-await',
];

// APIs the Kindle's engine lacks (same probe), keyed by name, with the text a
// bundle calling them contains. Lowering can't add these; legacy-boot
// polyfills the ones a Kindle-reachable page uses.
const KINDLE_MISSING_APIS: Record<string, string> = {
  'Promise.allSettled': 'allSettled',
  'Promise.any': 'Promise.any',
  AggregateError: 'AggregateError',
  'String.prototype.replaceAll': '.replaceAll(',
  'Array.prototype.at': '.at(',
  'Array.prototype.findLast': '.findLast',
  'Object.hasOwn': 'Object.hasOwn',
  structuredClone: 'structuredClone',
  WeakRef: 'WeakRef',
  'AbortSignal.timeout': 'AbortSignal.timeout',
  'Element.prototype.replaceChildren': '.replaceChildren(',
  'Array.prototype.toSorted': '.toSorted(',
  'Object.groupBy': 'groupBy(',
  'Intl.DisplayNames': 'DisplayNames',
};
// Bluesky sign-in's libraries (dynamic imports in chunk-BlueskyAuth) need
// crypto.subtle, which a plain-HTTP page never has, so the Kindle can't reach
// them in any case.
const SIGN_IN_ONLY = /^chunk-BlueskyAuth-/;

/** Bundles a browser can load from the page entries, minus sign-in's libraries. */
function kindleReachable(dir: string): Set<string> {
  const manifest = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8')) as {
    app_script: string;
    pages: Record<string, { js?: string }>;
  };
  const seen = new Set<string>();
  const queue = [manifest.app_script, ...Object.values(manifest.pages).map((p) => p.js).filter((js): js is string => !!js)];
  while (queue.length) {
    const f = queue.pop()!;
    if (seen.has(f) || !existsSync(join(dir, f))) continue;
    seen.add(f);
    const code = readFileSync(join(dir, f), 'utf8');
    for (const m of code.matchAll(/(?:from|import)\s*["'`]\.\/([^"'`]+)["'`]/g)) queue.push(m[1]);
    if (SIGN_IN_ONLY.test(f)) continue;
    for (const m of code.matchAll(/import\(\s*["'`]\.\/([^"'`]+)["'`]\s*\)/g)) queue.push(m[1]);
  }
  return seen;
}

/** Features present in `code`: lowering one changes the (unminified) output.
 *  Minified output can't be compared — the minifier re-creates `?.`. */
function featuresIn(code: string): string[] {
  const opts: TransformOptions = { loader: 'js', format: 'esm', target: 'esnext' };
  const base = transformSync(code, opts).code;
  return FORBIDDEN.filter((f) => {
    try {
      return transformSync(code, { ...opts, supported: { [f]: false } }).code !== base;
    } catch {
      return true; // esbuild can't lower it (e.g. top-level await): present
    }
  });
}

describe('legacy client build (scripts/build-legacy.ts)', () => {
  let dir: string;
  let bundles: string[];

  before(() => {
    dir = mkdtempSync(join(tmpdir(), 'pantry-legacy-'));
    bundles = readdirSync(SOURCE).filter((f) => f.endsWith('.js'));
    assert.ok(bundles.length > 0, `no bundles in ${SOURCE}`);
    for (const f of bundles) copyFileSync(join(SOURCE, f), join(dir, f));
    const r = spawnSync(process.execPath, ['--import', 'tsx', SCRIPT, dir], { cwd: REPO, encoding: 'utf8' });
    assert.equal(r.status, 0, r.stderr || r.stdout);
  });
  after(() => rmSync(dir, { recursive: true, force: true }));

  it('writes a legacy twin for every bundle', () => {
    const legacy = new Set(readdirSync(join(dir, 'legacy')));
    assert.deepEqual(bundles.filter((f) => !legacy.has(f)), []);
  });

  it('leaves no syntax the Kindle can’t parse', () => {
    const offenders = bundles
      .map((f) => ({ f, found: featuresIn(readFileSync(join(dir, 'legacy', f), 'utf8')) }))
      .filter((x) => x.found.length > 0);
    assert.deepEqual(offenders, []);
  });

  it('polyfills every API the Kindle lacks that its pages call', () => {
    const { script } = JSON.parse(
      readFileSync(join(REPO, 'packages/shared/src/legacy-boot.json'), 'utf8'),
    ) as { script: string };
    const unpolyfilled: string[] = [];
    for (const f of kindleReachable(SOURCE)) {
      const code = readFileSync(join(SOURCE, f), 'utf8');
      for (const [api, needle] of Object.entries(KINDLE_MISSING_APIS)) {
        if (code.includes(needle) && !script.includes(api)) unpolyfilled.push(`${api} in ${f}`);
      }
    }
    assert.deepEqual(unpolyfilled, [], 'add a guarded polyfill to packages/shared/src/legacy-boot.json');
  });

  it('keeps every relative import inside legacy/', () => {
    const missing: string[] = [];
    for (const f of bundles) {
      const code = readFileSync(join(dir, 'legacy', f), 'utf8');
      for (const m of code.matchAll(/(?:from|import\()\s*["'`]\.\/([^"'`]+)["'`]/g)) {
        if (!existsSync(join(dir, 'legacy', m[1]))) missing.push(`${f} → ${m[1]}`);
      }
    }
    assert.deepEqual(missing, []);
  });
});
