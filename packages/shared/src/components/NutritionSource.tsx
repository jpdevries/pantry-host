/**
 * Nutrition-panel precedence wrapper for the Recipe Detail page.
 *
 * Order of preference:
 *   1. recipe-api.com import with an API key available → fetched
 *      authoritative nutrition (`NutritionFacts`).
 *   2. At least one recipe ingredient matches a pantry row with OFF
 *      nutriments → estimated aggregate (`PantryNutritionFacts`).
 *   3. Otherwise → nothing.
 *
 * Recipe-api always wins when applicable — it's a single
 * authoritative number rather than a partial aggregate. The pantry
 * estimate only appears as a fallback for recipes that don't have
 * that canonical source.
 */
import { NutritionFacts } from './NutritionFacts';
import { PantryNutritionFacts } from './PantryNutritionFacts';
import { recipeApiIdFromSourceUrl } from '../recipe-api';
import type {
  RecipeIngredientForNutrition,
  PantryItemForNutrition,
} from '../nutrition-aggregate';

interface Props {
  sourceUrl: string | null | undefined;
  recipeApiKey: string | null | undefined;
  ingredients: RecipeIngredientForNutrition[];
  pantry: PantryItemForNutrition[];
  servings: number | null;
}

export function NutritionSource({
  sourceUrl,
  recipeApiKey,
  ingredients,
  pantry,
  servings,
}: Props) {
  // Recipe-api path — render if the recipe can plausibly be fetched
  // from there. NutritionFacts handles its own no-data silent-hide.
  const isRecipeApi = Boolean(recipeApiIdFromSourceUrl(sourceUrl ?? null)) && Boolean(recipeApiKey);
  if (isRecipeApi) {
    return <NutritionFacts sourceUrl={sourceUrl} apiKey={recipeApiKey} />;
  }

  // Pantry fallback — renders null when no contributors.
  return (
    <PantryNutritionFacts
      ingredients={ingredients}
      pantry={pantry}
      servings={servings}
    />
  );
}
