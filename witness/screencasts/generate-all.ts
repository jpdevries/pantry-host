/**
 * Generates themed screencasts: 4 palettes x 2 modes = 8 videos.
 * Runs each screencast as a separate process to ensure clean Witness state.
 *
 * Usage: npx tsx witness/screencasts/generate-all.ts [options]
 *
 * Options:
 *   --base-url <url>    Base URL (default: http://localhost:3000)
 *   --mp4               Also convert each .webm to .mp4 (requires ffmpeg)
 *   --flow <name>       Record a specific flow instead of "tour"
 *   --viewport <preset> desktop, mobile, tablet, or WxH (default: desktop)
 *   --clean             Remove ISE flash frames from MP4s (requires --mp4)
 */
import { execFileSync } from 'child_process';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { PALETTES, MODES } from '../lib/themes.js';

const BASE_URL = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : 'http://localhost:3000';

const convertMp4 = process.argv.includes('--mp4');
const cleanFrames = process.argv.includes('--clean');

const flowIdx = process.argv.indexOf('--flow');
const flowName = flowIdx !== -1 ? process.argv[flowIdx + 1] : 'tour';

const vpIdx = process.argv.indexOf('--viewport');
const vpName = vpIdx !== -1 ? process.argv[vpIdx + 1] : 'desktop';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output', 'screencasts');
const RECORD_SCRIPT = join(__dirname, 'record-one.ts');

async function run() {
  console.log(`\n  Pantry Host Themed Screencasts`);
  console.log(`  Base URL: ${BASE_URL}`);
  console.log(`  Flow: ${flowName}`);
  console.log(`  Viewport: ${vpName}`);
  console.log(`  MP4: ${convertMp4 ? 'yes' : 'no'}`);
  console.log(`  Output: ${OUTPUT_DIR}\n`);

  await mkdir(OUTPUT_DIR, { recursive: true });

  let passed = 0;
  let failed = 0;

  for (const palette of PALETTES) {
    for (const mode of MODES) {
      const label = `${palette}-${mode}`;
      try {
        const args = ['tsx', RECORD_SCRIPT, palette, mode, '--flow', flowName, '--base-url', BASE_URL, '--viewport', vpName];
        if (convertMp4) args.push('--mp4');
        if (cleanFrames) args.push('--clean');

        execFileSync('npx', args, {
          stdio: 'pipe',
          timeout: 180_000,
          env: { ...process.env, PATH: process.env.PATH },
        });
        console.log(`  \x1b[32m✓\x1b[0m ${label}`);
        passed++;
      } catch (err: any) {
        const stderr = err.stderr?.toString() ?? err.message;
        console.log(`  \x1b[31m✗\x1b[0m ${label}`);
        console.log(`    ${stderr.split('\n')[0]}`);
        failed++;
      }
    }
  }

  console.log(`\n  ${passed}/${passed + failed} screencasts generated${failed > 0 ? `, ${failed} failed` : ''}.\n`);
  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
