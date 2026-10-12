import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transform } from 'lightningcss';

// packages/app/styles/lite.css is the fallback for browsers below Tailwind
// v4's baseline (the Kindle's Silk 80 = Chromium 80). A syntax slip there
// (e.g. a stray `*/` in a comment) silently drops the whole sheet, and a
// modern feature silently drops a rule, with nothing failing in a modern
// browser. These checks keep the file honest about its header's promises.
const LITE = readFileSync(join(import.meta.dirname, '../../packages/app/styles/lite.css'), 'utf8');
const CODE = LITE.replace(/\/\*[\s\S]*?\*\//g, '');

describe('lite.css (legacy / e-ink fallback)', () => {
  it('parses without error recovery', () => {
    assert.doesNotThrow(() => transform({ filename: 'lite.css', code: Buffer.from(LITE), errorRecovery: false }));
  });

  it('is one @supports block gated on color-mix(), with the rules inside it', () => {
    const top = CODE.trim();
    assert.match(top, /^@supports not \(color: color-mix\(in srgb, red, red\)\) \{/);
    assert.ok(top.endsWith('}'));
    assert.ok((CODE.match(/\{/g) ?? []).length > 50, 'the gate still contains the stylesheet');
  });

  it('avoids features Chromium 80 lacks', () => {
    const forbidden: Array<[RegExp, string]> = [
      [/@layer\b/, '@layer (Chrome 99)'],
      [/&/, 'nesting (Chrome 112)'],
      [/:is\(|:where\(|:has\(/, ':is()/:where()/:has() (Chrome 88+)'],
      [/:focus-visible/, ':focus-visible (Chrome 86)'],
      [/aspect-ratio\s*:/, 'aspect-ratio (Chrome 88)'],
      [/[;{\s]inset\s*:/, 'inset shorthand (Chrome 87)'],
      [/(margin|padding)-(inline|block)\s*:/, 'logical shorthands (Chrome 87)'],
      [/oklch\(|light-dark\(/, 'oklch()/light-dark() (Chrome 111+)'],
      [/[;{\s]color-scheme\s*:/, 'color-scheme property (Chrome 81)'],
      [/[;{\s](row-|column-)?gap\s*:/, 'flex gap (Chrome 84) — use grid-gap on grids, margins on flex'],
    ];
    for (const [re, what] of forbidden) assert.ok(!re.test(CODE), `lite.css uses ${what}`);
    // The only color-mix() is the gate itself.
    assert.equal((CODE.match(/color-mix\(/g) ?? []).length, 1);
  });
});
