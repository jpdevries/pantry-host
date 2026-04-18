/**
 * FeaturedTags — checkbox shortcuts for commonly used tags.
 * Toggles tags in/out of a comma-separated tag string.
 */

/** Featured tags grouped into "diet/lifestyle assertions" and "warnings".
 *  Warnings render with an amber + ExclamationTriangle treatment on the
 *  recipe detail page (the same chip style as `breastfeeding-alert`). */
const FEATURED_TAGS: Array<{ value: string; label: string; warning?: boolean }> = [
  { value: 'gluten-free', label: 'Gluten-free' },
  { value: 'vegetarian', label: 'Vegetarian' },
  { value: 'vegan', label: 'Vegan' },
  { value: 'pescatarian', label: 'Pescatarian' },
  { value: 'pregnancy-safe', label: 'Pregnancy safe' },
  { value: 'breastfeeding-safe', label: 'Breastfeeding safe' },
  { value: 'lactation', label: 'Supports lactation' },
  { value: 'breastfeeding-alert', label: 'Breastfeeding alert', warning: true },
  // FDA Top 9 allergens. Surfaced as `contains-*` warning chips on
  // recipe detail and unioned with barcode-metadata allergens in
  // <AllergensLine>. Substance label is intentionally short so the
  // chip stays compact ("Contains: Milk", not "Contains: Cow's milk").
  { value: 'contains-milk', label: 'Contains milk', warning: true },
  { value: 'contains-eggs', label: 'Contains eggs', warning: true },
  { value: 'contains-fish', label: 'Contains fish', warning: true },
  { value: 'contains-shellfish', label: 'Contains shellfish', warning: true },
  { value: 'contains-tree-nuts', label: 'Contains tree nuts', warning: true },
  { value: 'contains-peanuts', label: 'Contains peanuts', warning: true },
  { value: 'contains-wheat', label: 'Contains wheat', warning: true },
  { value: 'contains-soy', label: 'Contains soy', warning: true },
  { value: 'contains-sesame', label: 'Contains sesame', warning: true },
];

/** Set of all allergen `contains-*` tag values, exported for renderers
 *  that need to detect "is this a warning tag?" without re-listing them. */
export const ALLERGEN_TAGS: ReadonlySet<string> = new Set(
  FEATURED_TAGS.filter((t) => t.value.startsWith('contains-')).map((t) => t.value),
);

/** Substance label for an allergen tag. "contains-tree-nuts" → "tree nuts". */
export function allergenSubstance(tag: string): string {
  return tag.replace(/^contains-/, '').replace(/-/g, ' ');
}

interface Props {
  tags: string;
  onChange: (tags: string) => void;
}

export default function FeaturedTags({ tags, onChange }: Props) {
  const tagList = tags.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean);

  function toggle(tag: string, checked: boolean) {
    const current = tags.split(',').map((t) => t.trim()).filter(Boolean);
    if (checked) {
      if (!current.some((t) => t.toLowerCase() === tag)) {
        onChange([...current, tag].join(', '));
      }
    } else {
      onChange(current.filter((t) => t.toLowerCase() !== tag).join(', '));
    }
  }

  return (
    <div className="mt-2 space-y-1">
      {FEATURED_TAGS.map(({ value, label, warning }) => (
        <label key={value} className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={tagList.includes(value)}
            onChange={(e) => toggle(value, e.target.checked)}
            className="w-4 h-4 accent-[var(--color-accent)]"
          />
          <span className="text-sm">{label}</span>
          {warning && (
            <span
              aria-hidden="true"
              className="ml-1 inline-block w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: 'var(--color-warning)' }}
              title="Warning tag"
            />
          )}
        </label>
      ))}
    </div>
  );
}
