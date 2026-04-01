/**
 * Convert .webm screencasts to .mp4 using ffmpeg.
 */
import { execFileSync } from 'child_process';
import { readdir } from 'fs/promises';
import { join } from 'path';

/**
 * Finds the .webm recording in a Witness session output directory
 * and converts it to .mp4.
 *
 * @param sessionDir - Witness output directory (e.g. ~/.witness/output/123-screencast-foo)
 * @param destPath - Where to write the .mp4
 */
export async function convertWebmToMp4(sessionDir: string, destPath: string): Promise<void> {
  const files = await readdir(sessionDir);
  const webm = files.find(f => f.endsWith('.webm'));
  if (!webm) {
    throw new Error(`No .webm found in ${sessionDir}`);
  }

  const srcPath = join(sessionDir, webm);

  execFileSync('ffmpeg', [
    '-i', srcPath,
    '-c:v', 'libx264',
    '-crf', '23',
    '-preset', 'medium',
    '-c:a', 'aac',
    '-movflags', '+faststart',
    '-y',
    destPath,
  ], { stdio: 'pipe', timeout: 60_000 });
}

/**
 * Finds the most recent Witness session directory matching a name prefix.
 */
export async function findSessionDir(namePrefix: string): Promise<string | null> {
  const witnessOutput = join(process.env.HOME!, '.witness', 'output');
  const dirs = await readdir(witnessOutput);

  // Witness directories are named <timestamp>-<session-name>
  const matches = dirs
    .filter(d => d.includes(namePrefix))
    .sort()
    .reverse();

  return matches.length > 0 ? join(witnessOutput, matches[0]) : null;
}
