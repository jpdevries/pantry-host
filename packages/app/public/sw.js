/**
 * Service Worker — two-cache architecture for atomic deploy invalidation.
 *
 * ## Two caches
 *
 * BUILD_CACHE (`pantry-host-{hash}`):
 *   HTML shells, Rex JS/CSS bundles, fonts, manifest.
 *   Versioned per deploy. Entire cache deleted when a new build deploys.
 *   The build hash comes from the SW registration URL (?v=abc123).
 *
 * ASSETS_CACHE (`pantry-host-uploads`):
 *   Uploaded recipe images (/uploads/uuid.jpg).
 *   Immortal — never purged on deploy. UUID filenames are immutable.
 *
 * ## How deploys work
 *
 * 1. Rex build generates a new build_id (8-char hash in bundle filenames)
 * 2. _document.tsx injects <meta name="build-hash" content="abc123">
 * 3. _app.tsx registers /sw.js?v=abc123
 * 4. Browser detects URL change → downloads new SW → triggers install
 * 5. Install: pre-cache shell pages into new BUILD_CACHE
 * 6. Activate: delete all caches EXCEPT current BUILD_CACHE and ASSETS_CACHE
 * 7. Result: stale HTML + old bundles gone, uploaded images preserved
 *
 * ## Caching strategies
 *
 * | Request type          | Cache         | Strategy               |
 * |-----------------------|---------------|------------------------|
 * | Shell pages (install) | BUILD_CACHE   | Pre-cache individually |
 * | /_rex/ bundles        | BUILD_CACHE   | Cache-first (immutable)|
 * | /uploads/ images      | ASSETS_CACHE  | Cache-first (immortal) |
 * | HTML navigation       | BUILD_CACHE   | Network-first          |
 * | Other same-origin     | BUILD_CACHE   | Stale-while-revalidate |
 * | Cross-origin          | —             | Ignored (passthrough)  |
 */

const BUILD_HASH = new URL(self.location).searchParams.get('v') || 'dev';
const BUILD_CACHE = `pantry-host-${BUILD_HASH}`;
const ASSETS_CACHE = 'pantry-host-uploads';

const SHELL_PAGES = ['/', '/list', '/recipes', '/ingredients', '/cookware', '/kitchens', '/menus', '/recipes/export'];

const NETWORK_TIMEOUT = 1500;

function fetchWithTimeout(request) {
  return Promise.race([
    fetch(request),
    new Promise((_, reject) => setTimeout(() => reject(new Error('SW timeout')), NETWORK_TIMEOUT)),
  ]);
}

// --- Lifecycle ---

self.addEventListener('install', (event) => {
  // Pre-cache shell pages into the new versioned build cache.
  // Individual add() calls so one failure doesn't abort the install.
  event.waitUntil(
    caches.open(BUILD_CACHE).then((cache) =>
      Promise.all(
        SHELL_PAGES.map((page) =>
          cache.add(page).catch((err) => console.warn('[SW] Failed to pre-cache', page, err))
        )
      )
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  // Delete all caches EXCEPT the current build cache and the immortal uploads cache.
  // This atomically purges stale HTML + old bundles from previous deploys.
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names
          .filter((n) => n !== BUILD_CACHE && n !== ASSETS_CACHE)
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
  );
});

// --- Fetch ---

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only handle same-origin — GraphQL (port 4001) is cross-origin
  if (url.origin !== self.location.origin) return;

  // --- Uploaded images: immortal cache ---
  if (url.pathname.startsWith('/uploads/')) {
    event.respondWith(
      caches.open(ASSETS_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // --- Rex bundles: cache-first (immutable hashed filenames) ---
  if (url.pathname.startsWith('/_rex/')) {
    event.respondWith(
      caches.open(BUILD_CACHE).then((cache) =>
        cache.match(request).then((cached) => {
          if (cached) return cached;
          return fetch(request).then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          });
        })
      )
    );
    return;
  }

  // --- HTML navigation: network-first with fallback ---
  if (request.mode === 'navigate') {
    event.respondWith(
      fetchWithTimeout(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(BUILD_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() =>
          caches.open(BUILD_CACHE).then((cache) =>
            cache.match(request).then((cached) => cached ?? cache.match('/'))
          )
        )
    );
    return;
  }

  // --- Other same-origin: stale-while-revalidate ---
  event.respondWith(
    caches.open(BUILD_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetchWithTimeout(request).then((response) => {
          cache.put(request, response.clone());
          return response;
        });
        return cached ?? networkFetch;
      })
    )
  );
});
