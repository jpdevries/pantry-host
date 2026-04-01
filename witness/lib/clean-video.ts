/**
 * Detect and remove "Internal Server Error" flash frames from screencast videos.
 *
 * Usage:
 *   npx tsx witness/lib/clean-video.ts <input.mp4> [--output cleaned.mp4]
 *   npx tsx witness/lib/clean-video.ts --dir witness/output/screencasts/
 *
 * Detection strategy:
 *   An ISE flash is a single frame (or 2-frame burst) where YAVG spikes well above
 *   both its predecessor and successor. Legitimate page transitions are sustained
 *   (the new brightness holds for many frames). The script detects isolated spikes
 *   where a frame is significantly brighter than BOTH its neighbors.
 */
import { execSync } from 'child_process';
import { readdirSync, renameSync, unlinkSync } from 'fs';
import { join, basename } from 'path';

const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const SPIKE_MIN = 3;     // frame must be at least this much brighter than neighbors
const BURST_MAX = 3;     // max consecutive bright frames to consider a "flash" (not a transition)

function getFrameBrightness(inputPath: string): number[] {
  const output = execSync(
    `${FFMPEG} -i "${inputPath}" -vf "signalstats,metadata=print:file=/dev/stdout" -f null - 2>/dev/null`,
    { encoding: 'utf-8', maxBuffer: 50 * 1024 * 1024 },
  );

  const values: number[] = [];
  for (const line of output.split('\n')) {
    if (line.includes('lavfi.signalstats.YAVG=')) {
      values.push(parseFloat(line.split('=')[1]));
    }
  }
  return values;
}

function findFlashFrames(values: number[]): number[] {
  const flashes: number[] = [];
  const n = values.length;

  let i = 0;
  while (i < n) {
    // Look for the start of a spike: frame is significantly brighter than the one before it
    const before = i > 0 ? values[i - 1] : values[i];
    if (values[i] - before < SPIKE_MIN) {
      i++;
      continue;
    }

    // Found a spike start at frame i. Count how many consecutive frames stay elevated.
    let burstEnd = i;
    while (burstEnd + 1 < n && values[burstEnd + 1] - before >= SPIKE_MIN) {
      burstEnd++;
    }
    const burstLen = burstEnd - i + 1;

    // Check the frame AFTER the burst drops back down
    const after = burstEnd + 1 < n ? values[burstEnd + 1] : values[burstEnd];
    const afterDrop = values[burstEnd] - after;

    // It's a flash if: short burst AND it drops back down after
    if (burstLen <= BURST_MAX && afterDrop >= SPIKE_MIN) {
      for (let j = i; j <= burstEnd; j++) {
        flashes.push(j);
      }
    }

    i = burstEnd + 1;
  }

  return flashes;
}

function removeFrames(inputPath: string, frames: number[], outputPath: string): void {
  const exclusions = frames.map(n => `eq(n\\,${n})`).join('+');
  const selectExpr = `select='not(${exclusions})',setpts=N/FRAME_RATE/TB`;

  execSync(
    `${FFMPEG} -y -i "${inputPath}" -vf "${selectExpr}" -c:v libx264 -crf 23 -preset medium -movflags +faststart "${outputPath}" 2>/dev/null`,
    { stdio: 'pipe', timeout: 60_000 },
  );
}

export function cleanVideo(inputPath: string, outputPath?: string): boolean {
  const values = getFrameBrightness(inputPath);
  const frames = findFlashFrames(values);

  if (frames.length === 0) {
    console.log(`  \x1b[90m-\x1b[0m ${basename(inputPath)} (clean)`);
    return false;
  }

  const details = frames.map(n => `${n}:${values[n].toFixed(1)}`).join(', ');
  const out = outputPath ?? inputPath.replace(/\.mp4$/, '-cleaned.mp4');
  removeFrames(inputPath, frames, out);

  // If no explicit output, replace the original
  if (!outputPath) {
    unlinkSync(inputPath);
    renameSync(out, inputPath);
  }

  console.log(`  \x1b[32m✓\x1b[0m ${basename(inputPath)} — removed ${frames.length} frame${frames.length > 1 ? 's' : ''} (${details})`);
  return true;
}

// --- CLI (only when run directly) ---

const isMain = process.argv[1]?.includes('clean-video');
if (isMain) {
  const args = process.argv.slice(2);
  const outputIdx = args.indexOf('--output');
  const outputPath = outputIdx !== -1 ? args[outputIdx + 1] : undefined;
  const dirIdx = args.indexOf('--dir');

  if (dirIdx !== -1) {
    const dir = args[dirIdx + 1];
    const files = readdirSync(dir).filter(f => f.endsWith('.mp4')).sort();
    console.log(`\n  Cleaning ${files.length} videos...\n`);
    let cleaned = 0;
    for (const file of files) {
      if (cleanVideo(join(dir, file))) cleaned++;
    }
    console.log(`\n  ${cleaned}/${files.length} videos had frames removed.\n`);
  } else if (args[0] && !args[0].startsWith('--')) {
    cleanVideo(args[0], outputPath);
  } else {
    console.error('Usage:');
    console.error('  npx tsx witness/lib/clean-video.ts <input.mp4> [--output out.mp4]');
    console.error('  npx tsx witness/lib/clean-video.ts --dir <directory>');
    process.exit(1);
  }
}
