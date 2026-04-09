/**
 * Pixabay fallback image client.
 *
 * Borrowed, not owned: we query Pixabay for a landscape photo matching
 * the recipe title, surface it on the card with courtesy photographer
 * attribution, and cache the metadata in localStorage keyed by recipe
 * id. Nothing ever touches PGlite or PostgreSQL. The cache can be wiped
 * at any time by toggling the feature off in Settings.
 *
 * License: Pixabay Content License — attribution is OPTIONAL. We still
 * render a "Photo by {user} on Pixabay" overlay for transparency and
 * visual consistency, but it's not a ToS requirement (unlike Unsplash).
 *
 * Rate limit: 100 req/min on the free tier, tied to the API key. Our
 * per-recipe cache pattern means the API only fires once per recipe per
 * browser, ever — subsequent renders read from localStorage.
 *
 * CORS: confirmed open (`access-control-allow-origin: *`) so browser
 * clients can call it directly from both packages. No proxy through any
 * Pantry Host server.
 *
 * Auth: API key as `?key=<apiKey>` query parameter. (Pixabay does not
 * support an Authorization header.) The key appears in the Network
 * panel URL but it's still the user's own credential in their own
 * browser — same practical threat model as any BYO-key flow.
 */

const PIXABAY_SEARCH_ENDPOINT = 'https://pixabay.com/api/';
const CACHE_KEY = 'pixabay:cache:v1';

/** One successful hit for a recipe. */
export interface PixabayHit {
  /** ~1280px landscape photo for the card. */
  urlLarge: string;
  /** ~640px photo for narrow viewports. */
  urlWeb: string;
  /** Photographer / uploader username (Pixabay `user` field). */
  photographerName: string;
  /** The photo's Pixabay detail page URL. */
  pageUrl: string;
  failed?: false;
}

/** A recipe we've already queried and failed to find a match for. */
export interface PixabayMiss {
  failed: true;
  at: number;
}

export type PixabayCacheEntry = PixabayHit | PixabayMiss;

type PixabayCache = Record<string, PixabayCacheEntry>;

// ── Attribution UTM helpers ────────────────────────────────────────────

/**
 * Append `?utm_source=pantry-host&utm_medium=referral` for analytics
 * consistency with the other borrowed-data sources. Pixabay does not
 * require this, but it keeps referrer attribution clean.
 */
export function withPixabayUtm(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set('utm_source', 'pantry-host');
    u.searchParams.set('utm_medium', 'referral');
    return u.toString();
  } catch {
    return url;
  }
}

export const PIXABAY_ROOT_ATTRIBUTION = withPixabayUtm('https://pixabay.com/');

// ── localStorage-backed per-recipe cache ───────────────────────────────

export function loadPixabayCache(): PixabayCache {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as PixabayCache;
    }
  } catch {
    /* corrupt cache → treat as empty */
  }
  return {};
}

export function getPixabayCacheEntry(recipeId: string): PixabayCacheEntry | null {
  return loadPixabayCache()[recipeId] ?? null;
}

export function savePixabayCacheEntry(recipeId: string, entry: PixabayCacheEntry): void {
  if (typeof window === 'undefined') return;
  try {
    const cache = loadPixabayCache();
    cache[recipeId] = entry;
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    /* storage full or disabled — silently skip */
  }
}

export function clearPixabayCache(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}

// ── API call ───────────────────────────────────────────────────────────

/**
 * The slim slice of a Pixabay hit that we actually use. Pixabay returns
 * many more fields (views, downloads, likes, comments, user_id,
 * userImageURL, etc.) — we intentionally don't store them to keep the
 * localStorage cache small.
 */
interface PixabayApiHit {
  id: number;
  pageURL: string;
  type: string;
  tags: string;
  previewURL: string;
  webformatURL: string;
  largeImageURL: string;
  user: string;
}

interface PixabayApiResponse {
  total: number;
  totalHits: number;
  hits: PixabayApiHit[];
}

function buildSearchUrl(query: string, apiKey: string, withFoodCategory: boolean): string {
  const url = new URL(PIXABAY_SEARCH_ENDPOINT);
  url.searchParams.set('key', apiKey);
  url.searchParams.set('q', query);
  url.searchParams.set('per_page', '3');
  url.searchParams.set('image_type', 'photo');
  url.searchParams.set('orientation', 'horizontal');
  url.searchParams.set('safesearch', 'true');
  if (withFoodCategory) url.searchParams.set('category', 'food');
  return url.toString();
}

async function fetchSearch(url: string): Promise<PixabayApiResponse | null> {
  const res = await fetch(url);
  // Pixabay returns HTTP 400 (with body "[ERROR 400] Invalid or missing
  // API key") when the key is rejected, not 401/403. We treat 400, 401,
  // and 403 all as "rejected key" so the caller can surface the error.
  if (res.status === 400 || res.status === 401 || res.status === 403) {
    throw new Error(`Pixabay rejected the API key (HTTP ${res.status}).`);
  }
  if (!res.ok) {
    // 429 / 5xx / network — swallow as "no match right now"
    return null;
  }
  return (await res.json()) as PixabayApiResponse;
}

function firstPhotoHit(response: PixabayApiResponse | null): PixabayApiHit | null {
  if (!response || !response.hits || response.hits.length === 0) return null;
  // Prefer an actual photo over illustration/vector when the pool has mixed types.
  const photo = response.hits.find((h) => h.type === 'photo');
  return photo ?? response.hits[0];
}

/**
 * Query Pixabay for a single landscape photo matching a recipe title.
 * Two-phase search: first try `category=food`, then fall back to the
 * unfiltered query if the food category yields zero results.
 *
 * Returns null on no-match or retryable failure. Throws on 401/403 so
 * the caller can distinguish "invalid key" from "no match".
 */
export async function searchPixabayPhoto(
  query: string,
  apiKey: string,
): Promise<PixabayHit | null> {
  // Phase 1: food-category search
  const foodUrl = buildSearchUrl(query, apiKey, true);
  const foodResponse = await fetchSearch(foodUrl);
  let hit = firstPhotoHit(foodResponse);

  // Phase 2: fallback without category filter
  if (!hit) {
    const bareUrl = buildSearchUrl(query, apiKey, false);
    const bareResponse = await fetchSearch(bareUrl);
    hit = firstPhotoHit(bareResponse);
  }

  if (!hit) return null;

  return {
    urlLarge: hit.largeImageURL,
    urlWeb: hit.webformatURL,
    photographerName: hit.user,
    pageUrl: hit.pageURL,
  };
}
