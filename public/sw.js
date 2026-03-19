/**
 * Service Worker — app shell caching only.
 *
 * NOTE: GraphQL requests go to port 4001. This SW runs on port 3000 and
 * cannot intercept cross-origin fetches. Data caching is handled at the
 * application level via localStorage (see lib/cache.ts).
 */

const CACHE_NAME = 'pantry-list-shell-v5';

// Pages to pre-cache on install
const SHELL_PAGES = ['/', '/list', '/recipes', '/ingredients', '/cookware', '/kitchens', '/menus'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_PAGES)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Network-first for all Rex assets (bundles, router, HMR client). Stale
  // cached versions of /_rex/router.js or hash-named bundles cause blank pages.
  if (url.pathname.startsWith('/_rex/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Network-first for HTML navigation requests (fall back to cache for offline)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached ?? caches.match('/')))
    );
    return;
  }

  // Stale-while-revalidate for other same-origin requests (images, fonts, etc.)
  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request).then((response) => {
        caches.open(CACHE_NAME).then((cache) => cache.put(request, response.clone()));
        return response;
      });
      return cached ?? networkFetch;
    })
  );
});
