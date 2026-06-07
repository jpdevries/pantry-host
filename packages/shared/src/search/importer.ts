/**
 * Omni Search import — turn a normalized `OmniResult` back into a Pantry
 * `ParsedRecipe`, fetching full detail where the search result was slim. This
 * generalizes the per-source `handleXyzImport` loops (e.g. `handleMealDBImport`
 * in the app's RecipeImportPage) over the source discriminant, reusing the
 * exact same shared converters.
 *
 * The actual persistence (`createRecipe`) is injected by the host page so this
 * module never has to know about the GraphQL client or kitchen routing.
 */
import { getMealDBRecipe, mealToRecipe, type MealDBMeal } from '../mealdb';
import { getCocktailDBRecipe, drinkToRecipe, type CocktailDBDrink } from '../cocktaildb';
import { getFederationRecipe, cooklangToRecipe } from '../cooklang';
import { fetchPublicDomainRecipe } from '../publicdomainrecipes';
import { getRecipeAPIRecipe, recipeApiToParsed, type ParsedRecipe } from '../recipe-api';
import { parseIngredientLine, type WikibooksEntry } from '../wikibooks';
import { fetchBlueskyRecipe } from '../bluesky';
import type { OmniResult } from './types';

const nullToUndef = <T>(v: T | null | undefined): T | undefined => (v == null ? undefined : v);

function wikibooksEntryToRecipe(e: WikibooksEntry): ParsedRecipe {
  return {
    title: e.title,
    instructions: e.instructions,
    servings: e.servings ?? undefined,
    tags: e.tags,
    sourceUrl: e.sourceUrl,
    ingredients: e.ingredients.map(parseIngredientLine),
  };
}

/**
 * Fetch (when needed) + convert a single omni result into a `ParsedRecipe`.
 * TheMealDB/TheCocktailDB search already returns full records, so we reuse the
 * `raw` payload; the others re-fetch detail by id.
 */
export async function omniResultToRecipe(
  result: OmniResult,
  ctx: { recipeApiKey?: string | null },
): Promise<ParsedRecipe> {
  switch (result.source) {
    case 'mealdb': {
      const raw = result.raw as MealDBMeal | undefined;
      const meal = raw && 'strInstructions' in raw ? raw : await getMealDBRecipe(result.id);
      if (!meal) throw new Error('Meal not found');
      const r = mealToRecipe(meal);
      return { ...r, photoUrl: nullToUndef(r.photoUrl), sourceUrl: nullToUndef(r.sourceUrl) };
    }
    case 'cocktaildb': {
      const raw = result.raw as CocktailDBDrink | undefined;
      const drink = raw && 'strInstructions' in raw ? raw : await getCocktailDBRecipe(result.id);
      if (!drink) throw new Error('Drink not found');
      const r = drinkToRecipe(drink);
      return { ...r, photoUrl: nullToUndef(r.photoUrl), sourceUrl: nullToUndef(r.sourceUrl) };
    }
    case 'cooklang': {
      const full = await getFederationRecipe(Number(result.id));
      return cooklangToRecipe(full);
    }
    case 'publicdomain': {
      const r = await fetchPublicDomainRecipe(result.id);
      return { ...r, photoUrl: nullToUndef(r.imageUrl) };
    }
    case 'recipe-api': {
      if (!ctx.recipeApiKey) throw new Error('recipe-api key required to import');
      const full = await getRecipeAPIRecipe(result.id, ctx.recipeApiKey);
      return recipeApiToParsed(full);
    }
    case 'wikibooks':
      return wikibooksEntryToRecipe(result.raw as WikibooksEntry);
    case 'bluesky':
      // result.id is the at:// URI.
      return fetchBlueskyRecipe(result.id);
    default: {
      const exhaustive: never = result.source;
      throw new Error(`Unknown omni source: ${String(exhaustive)}`);
    }
  }
}

/**
 * Convert + persist one omni result via the injected `createRecipe`.
 */
export async function importOmniResult(
  result: OmniResult,
  ctx: { recipeApiKey?: string | null; createRecipe: (recipe: ParsedRecipe) => Promise<void> },
): Promise<void> {
  const recipe = await omniResultToRecipe(result, ctx);
  await ctx.createRecipe(recipe);
}

export type { ParsedRecipe };
