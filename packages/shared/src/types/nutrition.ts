/**
 * Per-serving nutrition shape used by Recipe Detail's nutrition panel.
 *
 * Originally defined in `recipe-api.ts` for recipe-api.com imports.
 * Extracted here so alternate sources (e.g. Open Food Facts aggregated
 * across matched pantry ingredients) can feed the same display.
 *
 * All fields nullable — a source may only cover some nutrients, and
 * the display skips nulls.
 */
export interface NutritionPerServing {
  calories: number | null;
  protein_g: number | null;
  carbohydrates_g: number | null;
  fat_g: number | null;
  saturated_fat_g: number | null;
  trans_fat_g: number | null;
  monounsaturated_fat_g: number | null;
  polyunsaturated_fat_g: number | null;
  fiber_g: number | null;
  sugar_g: number | null;
  sodium_mg: number | null;
  cholesterol_mg: number | null;
  potassium_mg: number | null;
  calcium_mg: number | null;
  iron_mg: number | null;
  magnesium_mg: number | null;
  phosphorus_mg: number | null;
  zinc_mg: number | null;
  vitamin_a_mcg: number | null;
  vitamin_c_mg: number | null;
  vitamin_d_mcg: number | null;
  vitamin_e_mg: number | null;
  vitamin_k_mcg: number | null;
  vitamin_b6_mg: number | null;
  vitamin_b12_mcg: number | null;
  thiamin_mg: number | null;
  riboflavin_mg: number | null;
  niacin_mg: number | null;
  folate_mcg: number | null;
  water_g: number | null;
  alcohol_g: number | null;
  caffeine_mg: number | null;
}

/** Start from a fresh all-null row — sources fill in what they can. */
export function emptyNutrition(): NutritionPerServing {
  return {
    calories: null, protein_g: null, carbohydrates_g: null, fat_g: null,
    saturated_fat_g: null, trans_fat_g: null, monounsaturated_fat_g: null,
    polyunsaturated_fat_g: null, fiber_g: null, sugar_g: null,
    sodium_mg: null, cholesterol_mg: null, potassium_mg: null,
    calcium_mg: null, iron_mg: null, magnesium_mg: null,
    phosphorus_mg: null, zinc_mg: null, vitamin_a_mcg: null,
    vitamin_c_mg: null, vitamin_d_mcg: null, vitamin_e_mg: null,
    vitamin_k_mcg: null, vitamin_b6_mg: null, vitamin_b12_mcg: null,
    thiamin_mg: null, riboflavin_mg: null, niacin_mg: null,
    folate_mcg: null, water_g: null, alcohol_g: null, caffeine_mg: null,
  };
}
