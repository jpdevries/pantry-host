import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { transformSync } from 'esbuild';

// The inline legacy loader (packages/shared/src/legacy-boot.json) decides,
// once the module scripts have had their turn, whether to load the legacy
// copy of the bundles. Run it against a minimal fake browser.
const { script } = JSON.parse(
  readFileSync(join(import.meta.dirname, '../../packages/shared/src/legacy-boot.json'), 'utf8'),
) as { script: string };

const MODULES_SELECTOR = 'script[type="module"][src^="/_rex/static/"]';

interface FakeScript { type?: string; src?: string; onload?: () => void; getAttribute(n: string): string | null }
function moduleScript(src: string): FakeScript {
  return { src, getAttribute: (n) => (n === 'src' ? src : null) };
}

function run(opts: {
  ran?: '__REX_ROOT__' | '__REX_APP__';
  scripts?: string[];
  readyState?: string;
  pages?: Record<string, { js?: string }>;
  abortSignal?: Record<string, unknown>;
  noAbortController?: boolean;
  promise?: Record<string, unknown>;
} = {}) {
  const window: Record<string, unknown> = {};
  if (opts.ran) window[opts.ran] = {};
  if (opts.pages) window.__REX_MANIFEST__ = { pages: opts.pages };
  const nodes = (opts.scripts ?? ['/_rex/static/_app-abc.js', '/_rex/static/recipes-index-abc.js']).map(moduleScript);
  const appended: FakeScript[] = [];
  const listeners: Record<string, () => void> = {};
  const document = {
    readyState: opts.readyState ?? 'interactive',
    querySelectorAll: (sel: string) => (sel === MODULES_SELECTOR ? nodes : []),
    createElement: () => ({ getAttribute: () => null }) as FakeScript,
    body: { appendChild: (el: FakeScript) => { appended.push(el); } },
    addEventListener: (type: string, fn: () => void) => { listeners[type] = fn; },
  };
  const timers: Array<{ fn: () => void; ms: number }> = [];
  const setTimeout = (fn: () => void, ms: number) => { timers.push({ fn, ms }); };
  class AbortController {
    aborted = false;
    signal = { controller: this };
    abort() { this.aborted = true; }
  }
  const AbortSignal = opts.abortSignal ?? {};
  new Function('window', 'document', 'AbortSignal', 'AbortController', 'setTimeout', 'Promise', script)(
    window, document, AbortSignal, opts.noAbortController ? undefined : AbortController, setTimeout, opts.promise ?? Promise,
  );
  return { window, appended, listeners, AbortSignal, timers };
}

describe('legacy-boot loader (ES5, runs on the Kindle)', () => {
  it('does nothing when the regular bundles ran', () => {
    for (const ran of ['__REX_ROOT__', '__REX_APP__'] as const) {
      const pages = { '/recipes': { js: 'recipes-index-abc.js' } };
      const r = run({ ran, pages });
      assert.equal(r.appended.length, 0, ran);
      assert.equal(r.window.__REX_LEGACY__, undefined);
      assert.equal(pages['/recipes'].js, 'recipes-index-abc.js');
    }
  });

  it('loads the legacy _app, then the legacy page entry once _app has loaded', () => {
    const r = run();
    assert.equal(r.window.__REX_LEGACY__, true);
    assert.equal(r.appended.length, 1);
    assert.equal(r.appended[0].type, 'module');
    assert.equal(r.appended[0].src, '/_rex/static/legacy/_app-abc.js');
    r.appended[0].onload!();
    assert.equal(r.appended.length, 2);
    assert.equal(r.appended[1].src, '/_rex/static/legacy/recipes-index-abc.js');
    r.appended[1].onload!();
    assert.equal(r.appended.length, 2);
  });

  it('points the client router at the legacy page chunks, once', () => {
    const pages: Record<string, { js?: string }> = {
      '/recipes': { js: 'recipes-index-abc.js' },
      '/list': { js: 'legacy/list-abc.js' },
      '/api-only': {},
    };
    run({ pages });
    assert.deepEqual(pages, {
      '/recipes': { js: 'legacy/recipes-index-abc.js' },
      '/list': { js: 'legacy/list-abc.js' },
      '/api-only': {},
    });
  });

  it('waits for DOMContentLoaded while the document is still parsing', () => {
    const r = run({ readyState: 'loading' });
    assert.equal(r.appended.length, 0);
    r.listeners.DOMContentLoaded();
    assert.equal(r.appended[0].src, '/_rex/static/legacy/_app-abc.js');
  });

  it('ignores pages without Rex module scripts, and scripts already pointing at legacy/', () => {
    assert.equal(run({ scripts: [] }).appended.length, 0);
    assert.equal(run({ scripts: [] }).window.__REX_LEGACY__, undefined);
    assert.equal(run({ scripts: ['/_rex/static/legacy/_app-abc.js'] }).appended.length, 0);
  });

  it('polyfills AbortSignal.timeout only where it is missing', () => {
    const r = run({ ran: '__REX_ROOT__' });
    const timeout = r.AbortSignal.timeout as (ms: number) => { controller: { aborted: boolean } };
    assert.equal(typeof timeout, 'function');
    const signal = timeout(5000);
    assert.equal(r.timers[0].ms, 5000);
    assert.equal(signal.controller.aborted, false);
    r.timers[0].fn();
    assert.equal(signal.controller.aborted, true);

    const native = () => 'native';
    assert.equal(run({ ran: '__REX_ROOT__', abortSignal: { timeout: native } }).AbortSignal.timeout, native);
    assert.equal(run({ ran: '__REX_ROOT__', noAbortController: true }).AbortSignal.timeout, undefined);
  });

  it('polyfills Promise.allSettled only where it is missing', async () => {
    // Silk's engine is about Chromium 75; allSettled is 76.
    const P: Record<string, unknown> = { all: Promise.all.bind(Promise), resolve: Promise.resolve.bind(Promise) };
    run({ ran: '__REX_ROOT__', promise: P });
    const allSettled = P.allSettled as (it: Iterable<unknown>) => Promise<unknown[]>;
    assert.equal(typeof allSettled, 'function');
    assert.deepEqual(await allSettled(new Set([Promise.resolve(1), Promise.reject('no'), 3])), [
      { status: 'fulfilled', value: 1 },
      { status: 'rejected', reason: 'no' },
      { status: 'fulfilled', value: 3 },
    ]);
    const native = () => 'native';
    const withNative: Record<string, unknown> = { ...P, allSettled: native };
    run({ ran: '__REX_ROOT__', promise: withNative });
    assert.equal(withNative.allSettled, native);
  });

  it('is ES5', () => {
    assert.ok(!/=>|`|\blet\s|\bconst\s|\?\.|\?\?/.test(script), 'legacy-boot must be ES5');
    assert.doesNotThrow(() => transformSync(script, { loader: 'js', target: 'es5' }));
  });
});
