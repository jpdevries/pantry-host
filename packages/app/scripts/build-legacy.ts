/**
 * Legacy client build — run after `rex build` (it's part of `npm run build`).
 *
 * Writes a copy of every Rex client bundle to `.rex/build/client/legacy/`,
 * lowered by esbuild to syntax the Kindle Scribe's Silk browser can parse.
 * Modern browsers never request these files: the inline loader
 * (@pantry-host/shared/legacy-boot) only loads them when the regular bundles
 * didn't run.
 *
 * Why Chromium 75 when Silk reports Chromium 80: an on-device feature probe
 * puts its JS engine at about Chromium 75 (numeric separators parse;
 * `?.`, `??` and Promise.allSettled are missing). The minifier also emits
 * `??=` (Chromium 85) into React DOM and our own code. This only lowers
 * syntax: missing APIs are polyfilled by legacy-boot.
 *
 * Each file is transformed on its own and keeps its relative imports
 * (`./chunk-x.js`), so a legacy chunk only ever imports legacy chunks.
 * Rex (`rex start`) and the Rust server (`/_rex/static/{*path}`, embedded via
 * packages/server/scripts/sync-frontend.sh) both serve the subdirectory.
 *
 *   npx tsx scripts/build-legacy.ts [clientDir]   # default: .rex/build/client
 */
import { transform } from 'esbuild';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

// tests/integration/legacy-build.test.ts checks the output for the syntax
// this target exists to remove; update both together.
const LEGACY_TARGET = 'chrome75';

async function main() {
  const clientDir = resolve(process.argv[2] ?? join(__dirname, '..', '.rex', 'build', 'client'));
  const outDir = join(clientDir, 'legacy');

  const files = (await readdir(clientDir, { withFileTypes: true }))
    .filter((e) => e.isFile() && e.name.endsWith('.js'))
    .map((e) => e.name);
  if (files.length === 0) {
    throw new Error(`no .js files in ${clientDir} — run \`rex build\` first`);
  }

  await rm(outDir, { recursive: true, force: true });
  await mkdir(outDir);

  let bytesIn = 0;
  let bytesOut = 0;
  await Promise.all(
    files.map(async (name) => {
      const source = await readFile(join(clientDir, name), 'utf8');
      const { code } = await transform(source, {
        loader: 'js',
        format: 'esm',
        target: LEGACY_TARGET,
        minify: true,
        legalComments: 'none',
      });
      bytesIn += source.length;
      bytesOut += code.length;
      await writeFile(join(outDir, name), code);
    }),
  );

  const kb = (n: number) => `${Math.round(n / 1024)} KB`;
  console.log(`[build-legacy] ${files.length} bundles → legacy/ (${LEGACY_TARGET}): ${kb(bytesIn)} → ${kb(bytesOut)}`);
}

main().catch((err) => {
  console.error('[build-legacy]', err);
  process.exit(1);
});
