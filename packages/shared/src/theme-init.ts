/**
 * The inline theme bootstrap script, shared by Rex's `_app.tsx` and the
 * Rust SPA shell (which `include_str!`s `theme-init.json`). See the note in
 * the JSON for what it does and why it must stay ES5.
 */
import themeInit from './theme-init.json';

export const THEME_INIT_SCRIPT: string = themeInit.script;
