/**
 * SSR-safe browser/server detection.
 *
 * `typeof window !== 'undefined'` lies in Rex's V8 SSR isolate — Rex 0.20.x's
 * window polyfill aliases `globalThis.window = globalThis`, so the standard
 * Next-style guard takes the browser branch on the server, reaches for the
 * un-polyfilled `localStorage`, and crashes SSR. Same trap with `document`
 * and `navigator` (Rex stubs `navigator` to `{ userAgent: 'Rex' }` so the
 * polyfilled value is real but useless for feature checks).
 *
 * `requestAnimationFrame` is the discriminator that doesn't lie: universal
 * in real browsers (React 19 itself depends on it), never polyfilled in any
 * SSR runtime including Rex's. A browser without it is hypothetical.
 *
 * This file MUST stay free of imports — its job is to be safe in any
 * eval order during SSR.
 */
export const isBrowser = typeof requestAnimationFrame === 'function';
export const isServer = !isBrowser;
