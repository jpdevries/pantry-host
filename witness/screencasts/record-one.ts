/**
 * Records a single screencast.
 *
 * Usage:  npx tsx witness/screencasts/record-one.ts <palette> <mode> [options]
 *
 * Options:
 *   --flow <name>       Flow to record (default: tour)
 *   --base-url <url>    Base URL (default: http://localhost:3000)
 *   --mp4               Also convert the .webm to .mp4 (requires ffmpeg)
 *
 * Available flows: tour, queue-recipe, smoothie-bowl, recipe-search,
 *                  this-week-menu, import-recipe, bulk-import
 */
import { connect, disconnect, startSession, endSession, navigate, select, click } from '../lib/client.js';
import { modeButtonLabel, type Palette, type Mode } from '../lib/themes.js';
import { convertWebmToMp4, findSessionDir } from '../lib/convert.js';
import { FLOWS } from './demo-flow.js';
import { join, dirname } from 'path';
import { mkdir } from 'fs/promises';
import { fileURLToPath } from 'url';

const palette = process.argv[2] as Palette;
const mode = process.argv[3] as Mode;

const flowIdx = process.argv.indexOf('--flow');
const flowName = flowIdx !== -1 ? process.argv[flowIdx + 1] : 'tour';
const convertMp4 = process.argv.includes('--mp4');

const BASE_URL = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : 'http://localhost:3000';

if (!palette || !mode) {
  console.error('Usage: record-one.ts <palette> <mode> [--flow <name>] [--base-url URL] [--mp4]');
  console.error('Flows:', Object.keys(FLOWS).join(', '));
  process.exit(1);
}

const flowFn = FLOWS[flowName];
if (!flowFn) {
  console.error(`Unknown flow "${flowName}". Available: ${Object.keys(FLOWS).join(', ')}`);
  process.exit(1);
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, '..', 'output', 'screencasts');

async function run() {
  const label = `${palette}-${mode}-${flowName}`;
  const sessionName = `screencast-${label}`;

  await connect();
  await startSession(sessionName, {
    baseUrl: BASE_URL,
    headless: true,
    width: 1280,
    height: 720,
  });

  // Apply theme
  await navigate('/');
  await new Promise(r => setTimeout(r, 2000));
  await select({ selector: '[aria-label="Color palette"]' }, palette);
  await click({ text: modeButtonLabel(mode) });
  await navigate('/');
  await new Promise(r => setTimeout(r, 1000));

  // Run the flow
  await flowFn();

  await endSession();
  await disconnect();

  // Convert to MP4 if requested
  if (convertMp4) {
    const sessionDir = await findSessionDir(sessionName);
    if (sessionDir) {
      await mkdir(OUTPUT_DIR, { recursive: true });
      const mp4Path = join(OUTPUT_DIR, `${label}.mp4`);
      await convertWebmToMp4(sessionDir, mp4Path);
      console.log(`\x1b[32m✓\x1b[0m ${label} → ${mp4Path}`);
    } else {
      console.log(`\x1b[32m✓\x1b[0m ${label} (webm only — session dir not found for mp4)`);
    }
  } else {
    console.log(`\x1b[32m✓\x1b[0m ${label}`);
  }
}

run().catch((err) => {
  console.error(`\x1b[31m✗\x1b[0m ${palette}-${mode}-${flowName}: ${err.message}`);
  process.exit(1);
});
