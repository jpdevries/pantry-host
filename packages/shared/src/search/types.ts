/**
 * Omni Search — shared types for the unified "Search All Recipes" fan-out.
 *
 * One query is sprayed across every available recipe data source in parallel
 * and the results are normalized into a single `OmniResult` shape so they can
 * share one grid. The fan-out engine (`useOmniSearch`) and the UI
 * (`components/OmniSearch`) are package-agnostic; the two differences between
 * the self-hosted app (Rex) and the browser PWA — how Wikibooks and Bluesky
 * are fetched, and how a recipe is created — are injected via `OmniContext`
 * and the component's props.
 */
import type { WikibooksEntry } from '../wikibooks';

export type OmniSourceId =
  | 'bluesky'
  | 'mealdb'
  | 'cocktaildb'
  | 'cooklang'
  | 'publicdomain'
  | 'wikibooks'
  | 'recipe-api';

/** A single normalized search hit, source-agnostic. */
export interface OmniResult {
  source: OmniSourceId;
  sourceLabel: string;
  /**
   * Native id — `idMeal`, `idDrink`, federation id (stringified), slug,
   * recipe-api uuid, or an `at://` URI for Bluesky. Used both to build the
   * per-source import-detail link and to re-fetch full content on import.
   */
  id: string;
  title: string;
  image: string | null;
  tags: string[];
  /** Short secondary line, e.g. "Beef · British" or "@handle". */
  subtitle?: string | null;
  /** The native search object, handed back to `omniResultToRecipe` on import. */
  raw: unknown;
}

export type SourceStatus = 'idle' | 'loading' | 'done' | 'error' | 'skipped';

export interface PerSourceState {
  status: SourceStatus;
  count: number;
  error?: string | null;
  /** Reason shown when skipped, e.g. "add key" or "type 3+ chars". */
  note?: string | null;
}

/** A Bluesky feed hit, injected per-package (both hit feed.pantryhost.app). */
export interface BlueskyOmniHit {
  atUri: string;
  title: string;
  image?: string | null;
  tags?: string[];
  handle?: string | null;
}

/**
 * Per-package data access. Sources whose client lives in `@pantry-host/shared`
 * and works identically in both tiers (TheMealDB, TheCocktailDB, Cooklang,
 * Public Domain, recipe-api) need nothing here. Wikibooks and Bluesky differ
 * (app uses a server route / OPFS; both proxy the feed) so they're injected.
 */
export interface OmniContext {
  /** recipe-api is only queried when a key is configured (owner-gated, quota'd). */
  recipeApiKey?: string | null;
  /** Wikibooks search — app hits `/api/wikibooks`, web searches the OPFS dataset. */
  wikibooks?: (query: string) => Promise<WikibooksEntry[]>;
  /** Bluesky search — both filter the feed.pantryhost.app firehose client-side. */
  bluesky?: (query: string) => Promise<BlueskyOmniHit[]>;
}

export interface OmniAdapter {
  id: OmniSourceId;
  label: string;
  /** Minimum query length before this source is queried (API rate-limit guard). */
  minChars: number;
  search: (query: string) => Promise<OmniResult[]>;
}
