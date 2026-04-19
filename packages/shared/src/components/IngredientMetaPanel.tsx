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
import { isPluCode } from '../plu';
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

  // `barcode` is the catch-all identifier column — it holds UPC/EAN
  // (packaged goods) OR PLU (produce). Branch by length so rendering
  // and external links make sense. IFPS-sourced metadata sets
  // `plu_source: 'ifps'`; we double-gate on both so a pantry row
  // manually set to a 4-digit code without metadata is still
  // recognized as a PLU.
  const isPlu = !!barcode && isPluCode(barcode);
  const isIfps = isPlu || meta?.plu_source === 'ifps';
  const codeLabel = isPlu ? 'PLU' : 'Barcode';

  const offUrl = barcode && !isPlu
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
          <Row label={codeLabel}>
            <code className="text-xs">{barcode}</code>
          </Row>
        )}
        {/* PLU-sourced rows surface produce-specific fields from
            IFPS: commodity, variety, size, organic flag. OFF rows
            leave these null so the rows just don't render. */}
        {isIfps && meta?.commodity && <Row label="Commodity">{meta.commodity}</Row>}
        {isIfps && meta?.variety && <Row label="Variety">{meta.variety}</Row>}
        {isIfps && meta?.size && <Row label="Size">{meta.size}</Row>}
        {isIfps && meta?.organic && <Row label="Organic">Yes</Row>}
        {meta?.brands && <Row label="Brand">{meta.brands}</Row>}
        {scoreParts.length > 0 && <Row label="Scores">{scoreParts.join(' · ')}</Row>}
        {meta?.serving_size && <Row label="Serving">{meta.serving_size}</Row>}
        {labels.length > 0 && <Row label="Labels">{labels.join(', ')}</Row>}
        {categories.length > 0 && !isIfps && <Row label="Categories">{categories.join(', ')}</Row>}
        {isIfps && meta?.category && <Row label="Category">{meta.category}</Row>}
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
