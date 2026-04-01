/**
 * Theme constants and helpers for screencasts.
 * Since Witness has no evaluate() tool, theme changes are done via the Footer UI controls:
 *   - <select aria-label="Color palette"> for palette
 *   - <button aria-label="{Mode} theme"> for light/dark/system
 */

export type Palette = 'default' | 'rose' | 'rebecca' | 'claude';
export type Mode = 'light' | 'dark';

export const PALETTES: Palette[] = ['default', 'rose', 'rebecca', 'claude'];
export const MODES: Mode[] = ['light', 'dark'];

/** Maps Mode to the aria-label text on the footer radio buttons */
export function modeButtonLabel(mode: Mode): string {
  return mode === 'light' ? 'Light theme' : 'Dark theme';
}
