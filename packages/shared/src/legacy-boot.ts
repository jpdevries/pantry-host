/**
 * The inline legacy-bundle loader, shared by Rex's `_app.tsx` and the Rust
 * SPA shell (which `include_str!`s `legacy-boot.json`). See the note in the
 * JSON for what it does and why it must stay ES5.
 */
import legacyBoot from './legacy-boot.json';

export const LEGACY_BOOT_SCRIPT: string = legacyBoot.script;
