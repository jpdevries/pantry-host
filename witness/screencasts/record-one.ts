/**
 * Records a single screencast.
 *
 * Usage:  npx tsx witness/screencasts/record-one.ts <palette> <mode> [options]
 *
 * Options:
 *   --flow <name>       Flow to record (default: tour)
 *   --base-url <url>    Base URL (default: http://localhost:3000)
 *   --viewport <preset> Viewport size: desktop (1280x720), mobile (375x812),
 *                        tablet (768x1024), or WxH (e.g. 390x844). Default: desktop
 *   --mp4               Also convert the .webm to .mp4 (requires ffmpeg)
 *
 * Available flows: tour, queue-recipe, smoothie-bowl, recipe-search,
 *                  this-week-menu, import-recipe, bulk-import
 */
import { connect, disconnect, startSession, endSession, navigate } from '../lib/client.js';
import { type Palette, type Mode } from '../lib/themes.js';
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

const VIEWPORTS: Record<string, { width: number; height: number }> = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 375, height: 812 },
  tablet: { width: 768, height: 1024 },
};

function parseViewport(): { width: number; height: number } {
  const vpIdx = process.argv.indexOf('--viewport');
  if (vpIdx === -1) return VIEWPORTS.desktop;
  const val = process.argv[vpIdx + 1];
  if (VIEWPORTS[val]) return VIEWPORTS[val];
  const match = val?.match(/^(\d+)x(\d+)$/);
  if (match) return { width: Number(match[1]), height: Number(match[2]) };
  console.error(`Unknown viewport "${val}". Use: desktop, mobile, tablet, or WxH (e.g. 390x844)`);
  process.exit(1);
}

const viewport = parseViewport();
const vpLabel = process.argv.includes('--viewport')
  ? process.argv[process.argv.indexOf('--viewport') + 1]
  : 'desktop';

if (!palette || !mode) {
  console.error('Usage: record-one.ts <palette> <mode> [--flow <name>] [--base-url URL] [--viewport preset] [--mp4]');
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
  const label = vpLabel === 'desktop'
    ? `${palette}-${mode}-${flowName}`
    : `${palette}-${mode}-${flowName}-${vpLabel}`;
  const sessionName = `screencast-${label}`;

  await connect();
  await startSession(sessionName, {
    baseUrl: BASE_URL,
    headless: true,
    ...viewport,
  });

  // Pre-set theme via localStorage before the first visible page load
  await navigate(`/_witness-init.html?palette=${palette}&mode=${mode}`);
  await new Promise(r => setTimeout(r, 500));

  // Warm up: navigate to homepage so the SSR flash happens here, not in the flow
  await navigate('/');
  await new Promise(r => setTimeout(r, 3000));

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
