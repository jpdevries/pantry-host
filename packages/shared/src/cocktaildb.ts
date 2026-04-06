/**
 * TheCocktailDB API client and recipe converter.
 *
 * Free CORS-enabled JSON API for cocktail/drink search and import.
 * Same team and API shape as TheMealDB.
 * https://www.thecocktaildb.com/api.php
 */

const BASE = 'https://www.thecocktaildb.com/api/json/v1/1';

// ── Types ────────────────────────────────────────────────────────────────────

export interface CocktailDBDrink {
  idDrink: string;
  strDrink: string;
  strCategory: string | null;
  strAlcoholic: string | null;
  strInstructions: string | null;
  strDrinkThumb: string | null;
  strTags: string | null;
  strVideo: string | null;
  strSource: string | null;
  strGlass: string | null;
  [key: string]: string | null | undefined; // strIngredient1-15, strMeasure1-15
}

export interface CocktailDBSearchResult {
  idDrink: string;
  strDrink: string;
  strDrinkThumb: string | null;
  strCategory?: string | null;
  strAlcoholic?: string | null;
}

export interface CocktailDBCategory {
  strCategory: string;
}

// ── API functions ────────────────────────────────────────────────────────────

export async function searchCocktailDB(query: string): Promise<CocktailDBDrink[]> {
  const res = await fetch(`${BASE}/search.php?s=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error(`CocktailDB search failed: ${res.status}`);
  const data = await res.json() as { drinks: CocktailDBDrink[] | null };
  return data.drinks ?? [];
}

export async function filterCocktailsByCategory(category: string): Promise<CocktailDBSearchResult[]> {
  const res = await fetch(`${BASE}/filter.php?c=${encodeURIComponent(category)}`);
  if (!res.ok) throw new Error(`CocktailDB filter failed: ${res.status}`);
  const data = await res.json() as { drinks: CocktailDBSearchResult[] | null };
  return data.drinks ?? [];
}

export async function getCocktailDBRecipe(id: string): Promise<CocktailDBDrink | null> {
  const res = await fetch(`${BASE}/lookup.php?i=${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error(`CocktailDB lookup failed: ${res.status}`);
  const data = await res.json() as { drinks: CocktailDBDrink[] | null };
  return data.drinks?.[0] ?? null;
}

export async function getCocktailDBCategories(): Promise<CocktailDBCategory[]> {
  const res = await fetch(`${BASE}/list.php?c=list`);
  if (!res.ok) throw new Error(`CocktailDB categories failed: ${res.status}`);
  const data = await res.json() as { drinks: CocktailDBCategory[] };
  return data.drinks ?? [];
}

// ── Conversion ───────────────────────────────────────────────────────────────

/** Parse fraction strings like "1/4", "1 1/2", "3" */
function parseFraction(s: string): number | null {
  if (!s) return null;
  s = s.trim();
  const mixed = s.match(/^(\d+)\s+(\d+)\/(\d+)$/);
  if (mixed) return parseInt(mixed[1]) + parseInt(mixed[2]) / parseInt(mixed[3]);
  const frac = s.match(/^(\d+)\/(\d+)$/);
  if (frac) return parseInt(frac[1]) / parseInt(frac[2]);
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

/** Convert a TheCocktailDB drink to Pantry Host recipe format */
export function drinkToRecipe(drink: CocktailDBDrink): {
  title: string;
  instructions: string;
  tags: string[];
  photoUrl: string | null;
  sourceUrl: string | null;
  ingredients: { ingredientName: string; quantity: number | null; unit: string | null }[];
} {
  const ingredients: { ingredientName: string; quantity: number | null; unit: string | null }[] = [];

  for (let i = 1; i <= 15; i++) {
    const name = (drink[`strIngredient${i}`] as string | null)?.trim();
    if (!name) continue;
    const measure = (drink[`strMeasure${i}`] as string | null)?.trim() || '';

    const match = measure.match(/^([\d\s/]+)\s+(.+)$/);
    if (match) {
      ingredients.push({
        ingredientName: name,
        quantity: parseFraction(match[1]),
        unit: match[2].trim(),
      });
    } else if (measure) {
      const qty = parseFraction(measure);
      if (qty !== null) {
        ingredients.push({ ingredientName: name, quantity: qty, unit: null });
      } else {
        ingredients.push({ ingredientName: name, quantity: null, unit: measure });
      }
    } else {
      ingredients.push({ ingredientName: name, quantity: null, unit: null });
    }
  }

  const tags: string[] = [];
  if (drink.strTags) tags.push(...drink.strTags.split(',').map((t) => t.trim()).filter(Boolean));
  if (drink.strCategory) tags.push(drink.strCategory.toLowerCase());
  if (drink.strAlcoholic) tags.push(drink.strAlcoholic.toLowerCase());
  if (drink.strGlass) tags.push(drink.strGlass.toLowerCase());
  tags.push('thecocktaildb');

  return {
    title: drink.strDrink,
    instructions: drink.strInstructions ?? '',
    tags: [...new Set(tags)],
    photoUrl: drink.strDrinkThumb ?? null,
    sourceUrl: drink.strSource ?? null,
    ingredients,
  };
}
