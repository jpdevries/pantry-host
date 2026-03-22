/**
 * Service Worker — app shell caching only.
 *
 * NOTE: GraphQL requests go to port 4001. This SW runs on port 3000 and
 * cannot intercept cross-origin fetches. Data caching is handled at the
 * application level via localStorage (see lib/cache.ts).
 *
 * Build-hash aware: when a new Rex bundle is fetched, the SW detects the
 * build hash and purges stale bundles from previous builds so the cache
 * doesn't accumulate hundreds of dead entries across deploys.
 */

const CACHE_NAME = 'pantry-host-shell';

// Pages to pre-cache on install
const SHELL_PAGES = ['/', '/list', '/recipes', '/ingredients', '/cookware', '/kitchens', '/menus', '/recipes/export'];

// Extract the build hash from a Rex bundle filename (e.g. "chunk-esm-557eb197.js" → "557eb197")
function extractHash(pathname) {
  const match = pathname.match(/-([a-f0-9]{8})\.js/);
  return match ? match[1] : null;
}

// Remove cached /_rex/ entries whose hash doesn't match the current build
function purgeStaleAssets(cache, currentHash) {
  return cache.keys().then((requests) =>
    Promise.all(
      requests
        .filter((req) => {
          const url = new URL(req.url);
          if (!url.pathname.startsWith('/_rex/static/')) return false;
          const hash = extractHash(url.pathname);
          return hash && hash !== currentHash;
        })
        .map((req) => cache.delete(req))
    )
  );
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.all(
        SHELL_PAGES.map((page) =>
          cache.add(page).catch((err) => console.warn('[SW] Failed to pre-cache', page, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin requests
  if (url.origin !== self.location.origin) return;

  // Network-first for all Rex assets (bundles, router, HMR client).
  if (url.pathname.startsWith('/_rex/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, clone);
            // When we successfully fetch a new bundle, purge stale ones
            const hash = extractHash(url.pathname);
            if (hash) purgeStaleAssets(cache, hash);
          });
          return response;
        })
        .catch(() => caches.open(CACHE_NAME).then((cache) => cache.match(request)))
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
        .catch(() =>
          caches.open(CACHE_NAME).then((cache) =>
            cache.match(request).then((cached) => cached ?? cache.match('/'))
          )
        )
    );
    return;
  }

  // Stale-while-revalidate for other same-origin requests (images, fonts, etc.)
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetch(request).then((response) => {
          cache.put(request, response.clone());
          return response;
        });
        return cached ?? networkFetch;
      })
    )
  );
});
