/**
 * Service Worker for browser-native Pantry Host PWA.
 *
 * Strategy:
 *  - Navigation: network-first, fallback to cached shell.
 *  - Same-origin static assets: stale-while-revalidate (ok responses only).
 *  - Cooklang federation API (recipes.cooklang.org): cache-first with a
 *    24-hour TTL and background revalidate. Gated on response.ok so we
 *    never trap a 429 or 5xx in the cache. Stale entries are preferred
 *    over a fresh error response, so a rate-limited repeat search still
 *    shows the last good result instead of an empty page.
 *  - All user data lives in PGlite/IndexedDB — no remote user API to cache.
 */

const CACHE_NAME = 'pantryhost-web-v1';
const COOKLANG_CACHE = 'pantryhost-cooklang-v1';
const COOKLANG_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const PIXABAY_CACHE = 'pantryhost-pixabay-v1';
// Pixabay photo URLs are immutable — the bytes never change. We use a
// 1-year TTL as a finite stand-in for "never expire"; the browser's
// CacheStorage quota manager handles LRU eviction under storage pressure.
const PIXABAY_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 year
const KNOWN_CACHES = new Set([CACHE_NAME, COOKLANG_CACHE, PIXABAY_CACHE]);

const PRECACHE = [
  '/',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !KNOWN_CACHES.has(k)).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

function isCooklangFederation(url) {
  return url.hostname === 'recipes.cooklang.org';
}

// Third-party JSON APIs we cache in the 24h TTL bucket. Same semantics
// across all of them (ok-gated, stale-over-error). Pixabay's
// /api/ endpoint is included here to satisfy their ToS clause requiring
// integrators to "cache API responses to avoid identical requests within
// 24 hours." The shared client also keeps a per-recipe localStorage
// cache keyed on recipe id, but that doesn't dedupe identical title
// searches across different recipes — only this URL-keyed SW cache does.
function isCachedRecipeSource(url) {
  if (isCooklangFederation(url)) return true;
  if (url.hostname === 'recipe-api.com') return true;
  if (url.hostname === 'pixabay.com' && url.pathname.startsWith('/api')) return true;
  return false;
}

/**
 * Pixabay photo URLs (image bytes, not the JSON search API). Separate
 * bucket from the Cooklang/recipe-api/Pixabay-JSON bucket because
 * photos are immutable once published — we use a 1-year TTL.
 *
 * Pixabay serves image bytes from both `cdn.pixabay.com` and
 * `pixabay.com/get/…`. Match both.
 */
function isPixabayImage(url) {
  if (url.hostname === 'cdn.pixabay.com') return true;
  if (url.hostname === 'pixabay.com' && url.pathname.startsWith('/get/')) return true;
  return false;
}

/**
 * Clone a response and stamp it with an `X-Cached-At` header so we can
 * compute age when reading it back from the cache.
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
    if (fresh.ok) {
      await cache.put(request, await stampResponse(fresh));
    }
  } catch {
    /* background revalidate errors are swallowed */
  }
}

/**
 * Cooklang federation cache handler. Cache-first with TTL and graceful
 * degradation:
 *   - fresh hit (< TTL)  → return cached, kick off background revalidate
 *   - stale hit (>= TTL) → try network; on OK store + return, on fail return stale
 *   - miss               → network; on OK store + return, on fail throw
 */
async function cooklangHandler(request) {
  const cache = await caches.open(COOKLANG_CACHE);
  const cached = await cache.match(request);

  if (cached && ageOf(cached) < COOKLANG_TTL_MS) {
    // Fire-and-forget revalidate so repeat searches keep data fresh.
    revalidateCooklang(request, cache);
    return cached;
  }

  try {
    const fresh = await fetch(request);
    if (fresh.ok) {
      await cache.put(request, await stampResponse(fresh));
      return fresh;
    }
    // Non-OK (429, 5xx, etc) — prefer stale cache over the error.
    if (cached) return cached;
    return fresh;
  } catch (err) {
    if (cached) return cached;
    throw err;
  }
}

/**
 * Pixabay image cache handler. Cache-first with a long TTL (30 days)
 * because Pixabay photos are immutable — the URL is stable and the
 * bytes never change. No background revalidate needed.
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

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Skip non-GET requests
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Federated recipe sources (Cooklang + recipe-api.com): dedicated TTL cache.
  if (isCachedRecipeSource(url)) {
    event.respondWith(cooklangHandler(request));
    return;
  }

  // Pixabay photo bytes (not the JSON search API — that's cached
  // per-recipe in localStorage by the shared client, and the URL
  // includes the API key anyway).
  if (isPixabayImage(url)) {
    event.respondWith(pixabayHandler(request));
    return;
  }

  // Navigation requests: network-first, fallback to cached shell
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match('/') || new Response('Offline', { status: 503 }))
    );
    return;
  }

  // Same-origin static assets: stale-while-revalidate (don't cache errors)
  event.respondWith(
    caches.match(request).then((cached) => {
      const fetching = fetch(request).then((response) => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
      return cached || fetching;
    })
  );
});
