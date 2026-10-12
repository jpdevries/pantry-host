import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// The inline theme bootstrap (packages/shared/src/theme-init.json) is the one
// script the Kindle's Silk 80 runs, so it carries the no-JS-app theme switch
// (?theme=system|light|dark). Run it against a minimal fake browser.
const { script } = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../packages/shared/src/theme-init.json'), 'utf8'),
) as { script: string };

interface FakeLink { choice: string; attrs: Record<string, string>; getAttribute(n: string): string | null; setAttribute(n: string, v: string): void; removeAttribute(n: string): void }
function link(choice: string): FakeLink {
  const l: FakeLink = {
    choice,
    attrs: { 'data-theme-choice': choice },
    getAttribute: (n) => l.attrs[n] ?? null,
    setAttribute: (n, v) => { l.attrs[n] = v; },
    removeAttribute: (n) => { delete l.attrs[n]; },
  };
  return l;
}

function run(
  search: string,
  stored: Record<string, string> = {},
  opts: { storageThrows?: boolean; readyState?: string } = {},
) {
  const store = new Map(Object.entries(stored));
  const localStorage = {
    getItem: (k: string) => {
      if (opts.storageThrows) throw new Error('SecurityError');
      return store.has(k) ? store.get(k)! : null;
    },
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
  };
  const body = { dataset: {} as Record<string, string>, style: {} as Record<string, string> };
  const location = { pathname: '/settings', search, hash: '#stage' };
  let replaced: string | null = null;
  const history = { replaceState: (_s: unknown, _t: string, url: string) => { replaced = url; } };
  const links = ['system', 'light', 'dark'].map(link);
  const listeners: Record<string, () => void> = {};
  const document = {
    body,
    readyState: opts.readyState ?? 'complete',
    querySelector: () => null,
    querySelectorAll: (sel: string) => (sel === '[data-theme-choice]' ? links : []),
    addEventListener: (type: string, fn: () => void) => { listeners[type] = fn; },
  };
  const matchMedia = () => ({ matches: false, media: 'not all' }); // Silk 80: unsupported
  new Function('localStorage', 'location', 'history', 'document', 'matchMedia', script)(
    localStorage, location, history, document, matchMedia,
  );
  const current = () => links.filter((l) => l.attrs['aria-current'] === 'true').map((l) => l.choice);
  return { store, body, replaced, current, listeners };
}

describe('theme-init bootstrap (ES5, runs on the Kindle)', () => {
  it('?theme=dark saves the choice, applies it, and strips the param', () => {
    const r = run('?theme=dark');
    assert.equal(r.store.get('theme-preference'), 'dark');
    assert.equal(r.body.dataset.colorScheme, 'dark');
    assert.equal(r.body.style.colorScheme, 'dark');
    assert.equal(r.replaced, '/settings#stage');
  });

  it('?theme=system removes the key (like setThemePreference) and clears the scheme', () => {
    const r = run('?theme=system', { 'theme-preference': 'dark' });
    assert.equal(r.store.has('theme-preference'), false);
    assert.equal(r.body.dataset.colorScheme, undefined);
  });

  it('keeps other query params', () => {
    assert.equal(run('?a=1&theme=light&b=2').replaced, '/settings?a=1&b=2#stage');
    assert.equal(run('?theme=light&b=2').replaced, '/settings?b=2#stage');
    assert.equal(run('?a=1&theme=light').replaced, '/settings?a=1#stage');
  });

  it('ignores unknown values and leaves the URL alone without the param', () => {
    const bogus = run('?theme=neon', { 'theme-preference': 'light' });
    assert.equal(bogus.store.get('theme-preference'), 'light');
    assert.equal(bogus.replaced, null);
    const none = run('', { 'theme-preference': 'dark' });
    assert.equal(none.body.dataset.colorScheme, 'dark');
    assert.equal(none.replaced, null);
  });

  it('marks the current [data-theme-choice] link with aria-current', () => {
    assert.deepEqual(run('?theme=dark').current(), ['dark']);
    assert.deepEqual(run('', { 'theme-preference': 'light' }).current(), ['light']);
    assert.deepEqual(run('').current(), ['system']);
  });

  it('defers marking to DOMContentLoaded while the document is still parsing', () => {
    const r = run('?theme=light', {}, { readyState: 'loading' });
    assert.deepEqual(r.current(), [], 'links not parsed yet');
    r.listeners.DOMContentLoaded();
    assert.deepEqual(r.current(), ['light']);
  });

  it('survives storage that throws (private mode, blocked site data)', () => {
    assert.doesNotThrow(() => run('?theme=dark', {}, { storageThrows: true }));
  });

  it('stays ES5: no arrow functions, let/const, template literals, or optional chaining', () => {
    assert.ok(!/=>|`|\blet\s|\bconst\s|\?\.|\?\?/.test(script), 'theme-init must be ES5');
  });
});
