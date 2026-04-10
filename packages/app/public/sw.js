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
 * | Request type            | Cache           | Strategy                          |
 * |-------------------------|-----------------|-----------------------------------|
 * | Shell pages (install)   | BUILD_CACHE     | Pre-cache individually            |
 * | /_rex/ bundles          | BUILD_CACHE     | Cache-first (immutable)           |
 * | /uploads/ images        | ASSETS_CACHE    | Cache-first (immortal)            |
 * | /api/wikibooks          | ASSETS_CACHE    | Cache-first (static dataset)      |
 * | HTML navigation         | BUILD_CACHE     | Network-first + timeout           |
 * | Other same-origin       | BUILD_CACHE     | Stale-while-revalidate (.ok only) |
 * | recipes.cooklang.org    | COOKLANG_CACHE  | Cache-first 24h TTL + revalidate  |
 * | recipe-api.com          | COOKLANG_CACHE  | Cache-first 24h TTL + revalidate  |
 * | pixabay.com/api/        | COOKLANG_CACHE  | Cache-first 24h TTL + revalidate  |
 * | cdn.pixabay.com + /get/ | PIXABAY_CACHE   | Cache-first 1y TTL (immutable)    |
 * | Other cross-origin      | —               | Ignored (passthrough)             |
 */

const BUILD_HASH = new URL(self.location).searchParams.get('v') || 'dev';
const BUILD_CACHE = `pantry-host-${BUILD_HASH}`;
const ASSETS_CACHE = 'pantry-host-uploads';
const COOKLANG_CACHE = 'pantry-host-cooklang-v1';
const COOKLANG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PIXABAY_CACHE = 'pantry-host-pixabay-v1';
// Pixabay photo URLs are immutable — the bytes never change. We use a
// 1-year TTL as a finite stand-in for "never expire"; the browser's
// CacheStorage quota manager handles LRU eviction under storage pressure.
const PIXABAY_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year

// Caches that must survive a deploy activation (non-build-versioned).
const IMMORTAL_CACHES = new Set([ASSETS_CACHE, COOKLANG_CACHE, PIXABAY_CACHE]);

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
          .filter((n) => n !== BUILD_CACHE && !IMMORTAL_CACHES.has(n))
          .map((n) => caches.delete(n))
      )
    ).then(() => self.clients.claim())
     .then(() =>
       // Notify all open tabs/PWA windows that a new build is active so
       // they can reload and pick up fresh HTML + JS bundles. Without
       // this, homescreen PWAs stay stuck on stale assets forever.
       self.clients.matchAll({ type: 'window' }).then((clients) =>
         clients.forEach((client) => client.postMessage({ type: 'SW_UPDATED', build: BUILD_HASH }))
       )
     )
  );
});

// --- Federated recipe source cache helpers ---

function isCooklangFederation(url) {
  return url.hostname === 'recipes.cooklang.org';
}

// Third-party JSON APIs we cache in the 24h TTL bucket. Same semantics
// across all of them (ok-gated, stale-over-error). Pixabay's /api/
// endpoint is included to satisfy their ToS clause requiring integrators
// to "cache API responses to avoid identical requests within 24 hours".
function isCachedRecipeSource(url) {
  if (isCooklangFederation(url)) return true;
  if (url.hostname === 'recipe-api.com') return true;
  if (url.hostname === 'pixabay.com' && url.pathname.startsWith('/api')) return true;
  return false;
}

/**
 * Pixabay photo URLs. Separate bucket, longer TTL, no revalidate —
 * photos are immutable. Matches both `cdn.pixabay.com` and
 * `pixabay.com/get/…` since Pixabay serves image bytes from both.
 */
function isPixabayImage(url) {
  if (url.hostname === 'cdn.pixabay.com') return true;
  if (url.hostname === 'pixabay.com' && url.pathname.startsWith('/get/')) return true;
  return false;
}

/**
 * Clone a response and stamp it with an X-Cached-At header so we can
 * compute age when reading it back out of the cache.
 */
async function stampResponse(response) {
  const buf = await response.clone().arrayBuffer();
  const headers = new Headers(response.headers);
  headers.set('X-Cached-At', String(Date.now()));
  return new Response(buf, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function ageOf(cachedResponse) {
  const stamped = Number(cachedResponse.headers.get('X-Cached-At') || 0);
  if (!stamped) return Infinity;
  return Date.now() - stamped;
}

async function revalidateCooklang(request, cache) {
  try {
    const fresh = await fetch(request);
    if (fresh.ok) await cache.put(request, await stampResponse(fresh));
  } catch {
    /* background revalidate errors are swallowed */
  }
}

/**
 * Cache-first with TTL and graceful degradation:
 *   - fresh hit (< TTL)  → return cached, kick off background revalidate
 *   - stale hit (>= TTL) → try network; on OK store + return, on fail return stale
 *   - miss               → network; on OK store + return, on fail throw
 * Response.ok is required before storing so a 429 or 5xx can never get
 * trapped in the cache.
 */
async function cooklangHandler(request) {
  const cache = await caches.open(COOKLANG_CACHE);
  const cached = await cache.match(request);

  if (cached && ageOf(cached) < COOKLANG_TTL_MS) {
    revalidateCooklang(request, cache);
    return cached;
  }

  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(request, await stampResponse(fresh));
      return fresh;
    }
    if (cached) return cached; // prefer stale over 429/5xx
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

/**
 * Pixabay image cache handler. Cache-first, 30-day TTL, no revalidate.
 */
async function pixabayHandler(request) {
  const cache = await caches.open(PIXABAY_CACHE);
  const cached = await cache.match(request);
  if (cached && ageOf(cached) < PIXABAY_TTL_MS) return cached;
  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(request, await stampResponse(fresh));
      return fresh;
    }
    if (cached) return cached;
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

// --- Fetch ---

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Federated recipe sources (Cooklang + recipe-api.com): dedicated TTL cache.
  if (isCachedRecipeSource(url)) {
    event.respondWith(cooklangHandler(request));
    return;
  }

  // Pixabay photo bytes: dedicated long-TTL cache.
  if (isPixabayImage(url)) {
    event.respondWith(pixabayHandler(request));
    return;
  }

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

  // --- Wikibooks API: cache-first (static dataset, never changes) ---
  if (url.pathname.startsWith('/api/wikibooks')) {
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

  // --- Other same-origin: stale-while-revalidate (don't cache errors) ---
  event.respondWith(
    caches.open(BUILD_CACHE).then((cache) =>
      cache.match(request).then((cached) => {
        const networkFetch = fetchWithTimeout(request).then((response) => {
          if (response.ok) cache.put(request, response.clone());
          return response;
        });
        return cached ?? networkFetch;
      })
    )
  );
});
