/**
 * Omni Search adapters — wrap each existing per-source client into a uniform
 * `OmniAdapter` that returns normalized `OmniResult[]`. No new source clients;
 * everything here delegates to the shared `mealdb`/`cocktaildb`/`cooklang`/
 * `publicdomainrecipes`/`recipe-api` modules (or injected fetchers for
 * Wikibooks/Bluesky).
 *
 * `buildOmniAdapters(ctx)` returns only the sources that are actually usable
 * in the current context: the free CORS sources are always included; recipe-api
 * only when a key is present; Wikibooks/Bluesky only when their injected
 * fetchers are supplied by the host page.
 */
import { searchMealDB, type MealDBMeal } from '../mealdb';
import { searchCocktailDB, type CocktailDBDrink } from '../cocktaildb';
import { searchFederationRecipes } from '../cooklang';
import { searchPublicDomainRecipes, getPublicDomainImageUrl } from '../publicdomainrecipes';
import { searchRecipeAPI } from '../recipe-api';
import type { OmniAdapter, OmniContext, OmniResult } from './types';

const clean = (xs: (string | null | undefined)[]): string[] =>
  xs.filter((x): x is string => Boolean(x));

function mealdbAdapter(): OmniAdapter {
  return {
    id: 'mealdb',
    label: 'TheMealDB',
    minChars: 2,
    async search(query) {
      const meals = await searchMealDB(query);
      return meals.map<OmniResult>((m) => ({
        source: 'mealdb',
        sourceLabel: 'TheMealDB',
        id: m.idMeal,
        title: m.strMeal,
        image: m.strMealThumb,
        tags: clean([m.strCategory, m.strArea]).map((t) => t.toLowerCase()),
        subtitle: clean([m.strCategory, m.strArea]).join(' · ') || null,
        raw: m,
      }));
    },
  };
}

function cocktaildbAdapter(): OmniAdapter {
  return {
    id: 'cocktaildb',
    label: 'TheCocktailDB',
    minChars: 2,
    async search(query) {
      const drinks = await searchCocktailDB(query);
      return drinks.map<OmniResult>((d) => ({
        source: 'cocktaildb',
        sourceLabel: 'TheCocktailDB',
        id: d.idDrink,
        title: d.strDrink,
        image: d.strDrinkThumb,
        tags: clean([d.strCategory, d.strAlcoholic]).map((t) => t.toLowerCase()),
        subtitle: clean([d.strCategory, d.strAlcoholic]).join(' · ') || null,
        raw: d,
      }));
    },
  };
}

function cooklangAdapter(): OmniAdapter {
  return {
    id: 'cooklang',
    label: 'Cooklang',
    minChars: 3,
    async search(query) {
      const res = await searchFederationRecipes(query, 1, 12);
      return res.results.map<OmniResult>((r) => ({
        source: 'cooklang',
        sourceLabel: 'Cooklang',
        id: String(r.id),
        title: r.title,
        image: null,
        tags: (r.tags ?? []).map((t) => t.toLowerCase()),
        subtitle: r.summary ?? null,
        raw: r,
      }));
    },
  };
}

function publicdomainAdapter(): OmniAdapter {
  return {
    id: 'publicdomain',
    label: 'Public Domain',
    minChars: 2,
    async search(query) {
      const entries = searchPublicDomainRecipes(query).slice(0, 24);
      return entries.map<OmniResult>((e) => ({
        source: 'publicdomain',
        sourceLabel: 'Public Domain',
        id: e.slug,
        title: e.title,
        image: e.hasImage ? getPublicDomainImageUrl(e.slug) : null,
        tags: (e.tags ?? []).map((t) => t.toLowerCase()),
        subtitle: null,
        raw: e,
      }));
    },
  };
}

function recipeApiAdapter(apiKey: string): OmniAdapter {
  return {
    id: 'recipe-api',
    label: 'Recipe API',
    minChars: 3,
    async search(query) {
      const res = await searchRecipeAPI({ q: query, per_page: 12 }, apiKey);
      return res.data.map<OmniResult>((r) => ({
        source: 'recipe-api',
        sourceLabel: 'Recipe API',
        id: r.id,
        title: r.name,
        image: null,
        tags: clean([r.category, r.cuisine, r.difficulty, ...r.tags]).map((t) => t.toLowerCase()),
        subtitle: clean([r.category, r.cuisine]).join(' · ') || null,
        raw: r,
      }));
    },
  };
}

function wikibooksAdapter(search: NonNullable<OmniContext['wikibooks']>): OmniAdapter {
  return {
    id: 'wikibooks',
    label: 'Wikibooks',
    minChars: 2,
    async search(query) {
      const entries = (await search(query)).slice(0, 24);
      return entries.map<OmniResult>((e) => ({
        source: 'wikibooks',
        sourceLabel: 'Wikibooks',
        id: e.slug,
        title: e.title,
        image: null,
        tags: (e.tags ?? []).map((t) => t.toLowerCase()),
        subtitle: e.time ?? null,
        raw: e,
      }));
    },
  };
}

function blueskyAdapter(search: NonNullable<OmniContext['bluesky']>): OmniAdapter {
  return {
    id: 'bluesky',
    label: 'Bluesky',
    minChars: 2,
    async search(query) {
      const hits = await search(query);
      return hits.map<OmniResult>((h) => ({
        source: 'bluesky',
        sourceLabel: 'Bluesky',
        id: h.atUri,
        title: h.title,
        image: h.image ?? null,
        tags: (h.tags ?? []).map((t) => t.toLowerCase()),
        subtitle: h.handle ? `@${h.handle}` : null,
        raw: h,
      }));
    },
  };
}

/**
 * Assemble the active adapter list for a context. Order is the display order
 * in the results (Bluesky first, then the free APIs, recipe-api last).
 */
export function buildOmniAdapters(ctx: OmniContext): OmniAdapter[] {
  const adapters: OmniAdapter[] = [];
  if (ctx.bluesky) adapters.push(blueskyAdapter(ctx.bluesky));
  adapters.push(mealdbAdapter());
  adapters.push(cocktaildbAdapter());
  adapters.push(cooklangAdapter());
  adapters.push(publicdomainAdapter());
  if (ctx.wikibooks) adapters.push(wikibooksAdapter(ctx.wikibooks));
  if (ctx.recipeApiKey) adapters.push(recipeApiAdapter(ctx.recipeApiKey));
  return adapters;
}

// Re-export so a host can label a source it deliberately left out (e.g. show a
// "recipe-api — add key" chip even though no adapter was built for it).
export const ALL_SOURCE_LABELS: Record<string, string> = {
  bluesky: 'Bluesky',
  mealdb: 'TheMealDB',
  cocktaildb: 'TheCocktailDB',
  cooklang: 'Cooklang',
  publicdomain: 'Public Domain',
  wikibooks: 'Wikibooks',
  'recipe-api': 'Recipe API',
};

export type { MealDBMeal, CocktailDBDrink };
