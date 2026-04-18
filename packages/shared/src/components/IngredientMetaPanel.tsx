/**
 * Display-only panel for the barcode + allowlisted OFF metadata
 * stored on a pantry row. Used inside the IngredientForm edit flow,
 * collapsed under a "Meta info" disclosure. Could later slot into a
 * pantry-list "expand row" view as well.
 *
 * Renders a vertical key/value list (barcode, brand, scores, serving,
 * labels, categories, ingredients_text, allergens) followed by the
 * per-100g nutrition grid. Returns null when no useful data — keeps
 * the form quiet for hand-typed rows.
 */
import { ArrowSquareOut } from '@phosphor-icons/react';
import { safeParseMeta } from '../product-meta';
import { offToNutritionPer100g } from '../nutrition-aggregate';
import { emptyNutrition } from '../types/nutrition';
import { NutritionGrid } from './NutritionGrid';

interface Props {
  barcode: string | null | undefined;
  /** Serialized JSON of ProductMeta (as stored on the row). */
  productMeta: string | null | undefined;
}

/** "en:no-gluten" → "no gluten"; "fr:triman" → "triman". */
function stripLangPrefix(tag: string): string {
  const m = tag.match(/^[a-z]{2}:(.*)$/);
  return (m ? m[1] : tag).replace(/-/g, ' ');
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-baseline gap-1 sm:gap-3 py-1.5 border-b border-[var(--color-border-card)] last:border-b-0">
      <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] sm:w-32 sm:shrink-0">
        {label}
      </dt>
      <dd className="text-sm">{children}</dd>
    </div>
  );
}

export function IngredientMetaPanel({ barcode, productMeta }: Props) {
  const meta = safeParseMeta(productMeta);
  if (!barcode && !meta) return null;

  const offUrl = barcode
    ? `https://world.openfoodfacts.org/product/${encodeURIComponent(barcode)}`
    : null;

  // Aggregate per-100g nutriments into a NutritionPerServing-shaped
  // fragment so we can reuse <NutritionGrid> verbatim.
  const per100g = meta?.nutriments
    ? { ...emptyNutrition(), ...offToNutritionPer100g(meta.nutriments) }
    : null;

  const allergens = meta?.allergens_tags?.map(stripLangPrefix) ?? [];
  const labels = meta?.labels_tags?.map(stripLangPrefix) ?? [];
  const categories = meta?.categories_tags?.map(stripLangPrefix) ?? [];
  const scoreParts: string[] = [];
  if (meta?.nutriscore_grade) scoreParts.push(`Nutri-Score ${meta.nutriscore_grade.toUpperCase()}`);
  if (meta?.nova_group) scoreParts.push(`NOVA ${meta.nova_group}`);
  if (meta?.ecoscore_grade && meta.ecoscore_grade !== 'unknown' && meta.ecoscore_grade !== 'not-applicable') {
    scoreParts.push(`Eco-Score ${meta.ecoscore_grade.toUpperCase()}`);
  }

  return (
    <div className="mt-3">
      <dl>
        {barcode && (
          <Row label="Barcode">
            <code className="text-xs">{barcode}</code>
          </Row>
        )}
        {meta?.brands && <Row label="Brand">{meta.brands}</Row>}
        {scoreParts.length > 0 && <Row label="Scores">{scoreParts.join(' · ')}</Row>}
        {meta?.serving_size && <Row label="Serving">{meta.serving_size}</Row>}
        {labels.length > 0 && <Row label="Labels">{labels.join(', ')}</Row>}
        {categories.length > 0 && <Row label="Categories">{categories.join(', ')}</Row>}
        {meta?.ingredients_text && (
          <Row label="Ingredients">
            <span className="italic">{meta.ingredients_text}</span>
          </Row>
        )}
        {allergens.length > 0 && (
          <Row label="Contains">
            {allergens.map((a) => a.replace(/\b\w/g, (c) => c.toUpperCase())).join(', ')}
          </Row>
        )}
      </dl>

      {per100g && (
        <div className="mt-4">
          <NutritionGrid nutrition={per100g} caption="Nutrition (per 100 g)" />
        </div>
      )}

      {offUrl && (
        <p className="mt-4 text-xs">
          <a
            href={offUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:underline"
          >
            View on Open Food Facts <ArrowSquareOut size={12} aria-hidden />
          </a>
        </p>
      )}
    </div>
  );
}
