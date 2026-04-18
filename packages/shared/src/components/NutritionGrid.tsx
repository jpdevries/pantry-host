/**
 * Pure display block for per-serving nutrition. Source-agnostic — the
 * caller fetches/aggregates and hands the resulting NutritionPerServing
 * down. Used by both `<NutritionFacts>` (recipe-api source) and
 * `<PantryNutritionFacts>` (pantry-sourced OFF aggregation).
 *
 * Renders a primary grid (calories / macros / a few common micros)
 * plus a collapsed "More" disclosure containing every other non-null
 * value.
 *
 * When `approximate` is set, each primary value is prefixed with "≈"
 * to signal the number is an estimate (used for pantry-sourced
 * nutrition where coverage is partial).
 */
import { useId } from 'react';
import { CaretRight } from '@phosphor-icons/react';
import type { NutritionPerServing } from '../types/nutrition';

interface NutrientSpec {
  key: keyof NutritionPerServing;
  label: string;
  unit: string;
  precision?: number;
}

const PRIMARY: NutrientSpec[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal', precision: 0 },
  { key: 'protein_g', label: 'Protein', unit: 'g', precision: 1 },
  { key: 'carbohydrates_g', label: 'Carbs', unit: 'g', precision: 1 },
  { key: 'fat_g', label: 'Fat', unit: 'g', precision: 1 },
  { key: 'fiber_g', label: 'Fiber', unit: 'g', precision: 1 },
  { key: 'sugar_g', label: 'Sugar', unit: 'g', precision: 1 },
  { key: 'sodium_mg', label: 'Sodium', unit: 'mg', precision: 0 },
];

const SECONDARY: NutrientSpec[] = [
  { key: 'saturated_fat_g', label: 'Saturated fat', unit: 'g', precision: 1 },
  { key: 'trans_fat_g', label: 'Trans fat', unit: 'g', precision: 1 },
  { key: 'monounsaturated_fat_g', label: 'Monounsaturated fat', unit: 'g', precision: 1 },
  { key: 'polyunsaturated_fat_g', label: 'Polyunsaturated fat', unit: 'g', precision: 1 },
  { key: 'cholesterol_mg', label: 'Cholesterol', unit: 'mg', precision: 0 },
  { key: 'potassium_mg', label: 'Potassium', unit: 'mg', precision: 0 },
  { key: 'calcium_mg', label: 'Calcium', unit: 'mg', precision: 0 },
  { key: 'iron_mg', label: 'Iron', unit: 'mg', precision: 1 },
  { key: 'magnesium_mg', label: 'Magnesium', unit: 'mg', precision: 0 },
  { key: 'phosphorus_mg', label: 'Phosphorus', unit: 'mg', precision: 0 },
  { key: 'zinc_mg', label: 'Zinc', unit: 'mg', precision: 1 },
  { key: 'vitamin_a_mcg', label: 'Vitamin A', unit: 'mcg', precision: 0 },
  { key: 'vitamin_c_mg', label: 'Vitamin C', unit: 'mg', precision: 0 },
  { key: 'vitamin_d_mcg', label: 'Vitamin D', unit: 'mcg', precision: 1 },
  { key: 'vitamin_e_mg', label: 'Vitamin E', unit: 'mg', precision: 1 },
  { key: 'vitamin_k_mcg', label: 'Vitamin K', unit: 'mcg', precision: 0 },
  { key: 'vitamin_b6_mg', label: 'Vitamin B6', unit: 'mg', precision: 1 },
  { key: 'vitamin_b12_mcg', label: 'Vitamin B12', unit: 'mcg', precision: 1 },
  { key: 'thiamin_mg', label: 'Thiamin', unit: 'mg', precision: 1 },
  { key: 'riboflavin_mg', label: 'Riboflavin', unit: 'mg', precision: 1 },
  { key: 'niacin_mg', label: 'Niacin', unit: 'mg', precision: 1 },
  { key: 'folate_mcg', label: 'Folate', unit: 'mcg', precision: 0 },
  { key: 'caffeine_mg', label: 'Caffeine', unit: 'mg', precision: 0 },
  { key: 'alcohol_g', label: 'Alcohol', unit: 'g', precision: 1 },
];

function fmt(value: number | null, precision = 0): string {
  if (value == null) return '—';
  return value.toFixed(precision);
}

interface Props {
  nutrition: NutritionPerServing;
  /** When true, prefix each primary value with "≈" to signal
   *  approximate/partial data. Used by pantry-sourced aggregation. */
  approximate?: boolean;
}

export function NutritionGrid({ nutrition, approximate = false }: Props) {
  const moreId = useId();
  return (
    <>
      <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-3">
        {PRIMARY.map(({ key, label, unit, precision }) => (
          <div key={key as string} className="flex flex-col">
            <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)]">{label}</dt>
            <dd className="text-lg tabular-nums">
              {approximate && nutrition[key] != null && (
                <span aria-hidden="true" className="text-[var(--color-text-secondary)] mr-0.5">≈</span>
              )}
              {fmt(nutrition[key] as number | null, precision)}
              <span className="text-xs text-[var(--color-text-secondary)] ml-1">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>

      <details className="group/more mt-5" aria-controls={moreId}>
        <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] select-none hover:text-[var(--color-text-primary)] group-open/more:text-[var(--color-text-primary)] list-none [&::-webkit-details-marker]:hidden inline-flex items-center gap-2">
          <CaretRight size={12} weight="bold" aria-hidden className="transition-transform group-open/more:rotate-90" />
          More
        </summary>
        <dl id={moreId} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-2 mt-3">
          {SECONDARY.map(({ key, label, unit, precision }) => {
            const value = nutrition[key] as number | null;
            if (value == null) return null;
            return (
              <div key={key as string} className="flex justify-between text-sm">
                <dt className="text-[var(--color-text-secondary)]">{label}</dt>
                <dd className="tabular-nums">
                  {approximate && <span aria-hidden="true" className="text-[var(--color-text-secondary)] mr-0.5">≈</span>}
                  {fmt(value, precision)} <span className="text-xs text-[var(--color-text-secondary)]">{unit}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </details>
    </>
  );
}
