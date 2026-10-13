/**
 * Build a kitchen as a pandoc Markdown book, for the publish-kitchen skill
 * (`packages/app/scripts/publish-book.ts` turns it into an EPUB).
 *
 * Pure string building with no I/O: the caller fetches the kitchen with
 * BOOK_QUERY, downloads photos, and runs pandoc with the returned
 * `splitLevel` / `tocDepth`. Ingredient and step formatting comes from
 * export-recipe so the HTML export and the book can't drift apart.
 */

import { formatIngredient, parseInstructionSteps } from './export-recipe';
import { compareText } from './compare-text';
import { COURSE_LABELS } from './constants';

export interface BookIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  itemSize: number | null;
  itemSizeUnit: string | null;
  sourceRecipeId: string | null;
}

export interface BookRecipe {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  instructions: string;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  tags: string[];
  requiredCookware: { name: string }[];
  sourceUrl: string | null;
  photoUrl: string | null;
  ingredients: BookIngredient[];
}

export interface BookMenu {
  id: string;
  title: string;
  description: string | null;
  active: boolean;
  recipes: { course: string | null; sortOrder: number | null; recipe: { id: string; title: string; tags: string[] } }[];
}

export interface BookInput {
  kitchen: { slug: string; name: string };
  recipes: BookRecipe[];
  menus: BookMenu[];
  /** Recipe id → photo path relative to pandoc's working directory. */
  images?: Record<string, string>;
  /** Hostnames that supplied photos, credited in About This Book. */
  photoCredits?: string[];
  /** Export date, YYYY-MM-DD. */
  date: string;
}

export interface Book {
  markdown: string;
  /** Pandoc YAML metadata (title, identifier, accessibility). */
  metadata: string;
  css: string;
  /** "29 recipes · October 12, 2026", for the title page and cover. */
  subtitle: string;
  /** Recipes in book order (also the order the cover should take photos in). */
  recipes: BookRecipe[];
  splitLevel: 1 | 2;
  tocDepth: 1 | 2;
}

export const KITCHENS_QUERY = `query BookKitchens { kitchens { slug name } }`;

export const BOOK_QUERY = `query Book($kitchenSlug: String) {
  kitchen(slug: $kitchenSlug) { slug name }
  recipes(kitchenSlug: $kitchenSlug) {
    id slug title description instructions servings prepTime cookTime tags
    requiredCookware { name } sourceUrl photoUrl
    ingredients { ingredientName quantity unit itemSize itemSizeUnit sourceRecipeId }
  }
  menus(kitchenSlug: $kitchenSlug) {
    id title description active
    recipes { course sortOrder recipe { id title tags } }
  }
}`;

/** Same order as the app's menu page (MenuDetailPage). */
const COURSE_ORDER = ['baby', 'appetizer', 'breakfast', 'main-course', 'side', 'beverage', 'dessert', 'other'];

/** A menu item's course, inferring "other" from tags the way the menu page does. */
function courseOf(item: BookMenu['recipes'][number]): string {
  const course = item.course || 'other';
  if (course !== 'other') return course;
  const tags = item.recipe.tags.map((t) => t.toLowerCase());
  if (tags.includes('baby-food') || tags.includes('first-foods')) return 'baby';
  return COURSE_ORDER.find((c) => c !== 'other' && tags.includes(c)) ?? 'other';
}

function courseLabel(course: string, menuTitle: string): string {
  const label = COURSE_LABELS[course] || course;
  return label.toLowerCase() === menuTitle.toLowerCase() ? 'Plates' : label;
}

/** Above this many recipes the book groups them under A–Z section headings. */
export const LETTER_GROUP_THRESHOLD = 40;

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** "2026-10-12" → "October 12, 2026" without Intl. */
export function formatBookDate(isoDate: string): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  return `${MONTHS[m - 1]} ${d}, ${y}`;
}

const FRACTIONS: [number, string][] = [[1 / 8, '⅛'], [1 / 4, '¼'], [1 / 3, '⅓'], [1 / 2, '½'], [2 / 3, '⅔'], [3 / 4, '¾']];

/** 0.5 → "½", 1.25 → "1¼", 0.4 → "0.4". */
export function formatQuantity(n: number): string {
  const whole = Math.floor(n);
  const frac = n - whole;
  if (frac < 0.01) return String(whole);
  const hit = FRACTIONS.find(([v]) => Math.abs(v - frac) < 0.02);
  if (hit) return whole ? `${whole}${hit[1]}` : hit[1];
  return String(Math.round(n * 100) / 100);
}

/**
 * Escape text for pandoc Markdown. Pandoc lets any ASCII punctuation be
 * backslash-escaped, so escaping all of it is safe and stops a title like
 * "1. Mojito" or "*Best* Chili" from turning into a list or emphasis.
 * Collapses whitespace so stray newlines can't start a new block.
 */
export function escapeMarkdown(text: string): string {
  return text.replace(/\s+/g, ' ').trim().replace(/[!-\/:-@\[-`{-~]/g, '\\$&');
}

export function recipeAnchor(recipe: Pick<BookRecipe, 'id' | 'slug'>): string {
  return `recipe-${recipe.slug || recipe.id}`;
}

export function bookFileName(kitchenSlug: string): string {
  return `pantry-host-${kitchenSlug}.epub`;
}

/** AT URIs link to the public viewer; http(s) sources link as-is. */
function sourceLink(sourceUrl: string): string | null {
  if (/^https?:\/\//i.test(sourceUrl)) return `<${sourceUrl}>`;
  if (sourceUrl.startsWith('at://')) {
    return `[Bluesky](https://my.pantryhost.app/at/${sourceUrl.slice('at://'.length)})`;
  }
  return null;
}

function letterOf(title: string): string {
  const c = title.trim().charAt(0).toUpperCase();
  return c >= 'A' && c <= 'Z' ? c : '#';
}

function renderRecipe(r: BookRecipe, level: 1 | 2, inBook: Map<string, BookRecipe>, image: string | undefined): string[] {
  const h = '#'.repeat(level);
  const sub = '#'.repeat(level + 1);
  const out: string[] = [`${h} ${escapeMarkdown(r.title)} {#${recipeAnchor(r)}}`, ''];
  // Empty alt: the heading already names the dish, so the photo is decorative.
  if (image) out.push(`![](${image}){.photo}`, '');
  const meta: string[] = [];
  if (r.servings) meta.push(`Serves ${r.servings}`);
  if (r.prepTime) meta.push(`Prep ${r.prepTime} min`);
  if (r.cookTime) meta.push(`Cook ${r.cookTime} min`);
  if (meta.length) out.push('::: meta', meta.join(' · '), ':::', '');
  if (r.description) out.push(escapeMarkdown(r.description), '');
  if (r.ingredients.length) {
    out.push(`${sub} Ingredients {.unlisted}`, '');
    for (const ing of r.ingredients) {
      const text = escapeMarkdown(formatIngredient(ing, formatQuantity));
      const linked = ing.sourceRecipeId ? inBook.get(ing.sourceRecipeId) : undefined;
      out.push(linked ? `- [${text}](#${recipeAnchor(linked)})` : `- ${text}`);
    }
    out.push('');
  }
  const steps = parseInstructionSteps(r.instructions);
  if (steps.length) {
    out.push(`${sub} Instructions {.unlisted}`, '');
    steps.forEach((step, n) => out.push(`${n + 1}. ${escapeMarkdown(step)}`));
    out.push('');
  }
  if (r.requiredCookware.length) {
    out.push(`Cookware: ${r.requiredCookware.map((c) => escapeMarkdown(c.name)).join(', ')}`, '');
  }
  const source = r.sourceUrl ? sourceLink(r.sourceUrl) : null;
  if (source) out.push('::: source', `Source: ${source}`, ':::', '');
  return out;
}

export function buildBook(input: BookInput): Book {
  const { kitchen, date } = input;
  const images = input.images ?? {};
  const recipes = [...input.recipes].sort((a, b) => compareText(a.title, b.title));
  const menus = input.menus.filter((m) => m.active).sort((a, b) => compareText(a.title, b.title));
  const inBook = new Map(recipes.map((r) => [r.id, r]));
  const grouped = recipes.length > LETTER_GROUP_THRESHOLD;
  const out: string[] = [];

  if (menus.length) {
    out.push('# Menus {#menus}', '');
    for (const m of menus) {
      out.push(`## ${escapeMarkdown(m.title)}`, '');
      if (m.description) out.push(escapeMarkdown(m.description), '');
      const byCourse = new Map<string, BookMenu['recipes']>();
      for (const item of [...m.recipes].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))) {
        const course = courseOf(item);
        byCourse.set(course, [...(byCourse.get(course) ?? []), item]);
      }
      const rank = (c: string) => (COURSE_ORDER.includes(c) ? COURSE_ORDER.indexOf(c) : 99);
      for (const course of [...byCourse.keys()].sort((a, b) => rank(a) - rank(b))) {
        out.push(`### ${escapeMarkdown(courseLabel(course, m.title))} {.unlisted}`, '');
        for (const item of byCourse.get(course)!) {
          const r = inBook.get(item.recipe.id);
          out.push(r ? `- [${escapeMarkdown(r.title)}](#${recipeAnchor(r)})` : `- ${escapeMarkdown(item.recipe.title)}`);
        }
        out.push('');
      }
    }
  }

  let letter = '';
  for (const r of recipes) {
    if (grouped && letterOf(r.title) !== letter) {
      letter = letterOf(r.title);
      out.push(`# ${letter === '#' ? '0–9' : letter} {#letter-${letter === '#' ? 'other' : letter.toLowerCase()}}`, '');
    }
    out.push(...renderRecipe(r, grouped ? 2 : 1, inBook, images[r.id]));
  }

  const tags = new Map<string, BookRecipe[]>();
  for (const r of recipes) {
    for (const raw of r.tags) {
      const tag = raw.trim();
      if (tag) tags.set(tag, [...(tags.get(tag) ?? []), r]);
    }
  }
  if (tags.size) {
    out.push('# Index by Tag {#tag-index}', '');
    for (const [tag, rs] of [...tags].sort(([a], [b]) => compareText(a, b))) {
      out.push(`**${escapeMarkdown(tag)}**: ${rs.map((r) => `[${escapeMarkdown(r.title)}](#${recipeAnchor(r)})`).join(', ')}`, '');
    }
  }

  const longDate = formatBookDate(date);
  const counts = `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'}${menus.length ? ` and ${menus.length} ${menus.length === 1 ? 'menu' : 'menus'}` : ''}`;
  out.push('# About This Book {#colophon}', '');
  out.push(`Exported from the ${escapeMarkdown(kitchen.name)} kitchen in Pantry Host on ${longDate}: ${counts}.`, '');
  if (input.photoCredits?.length) {
    out.push(`Photos from ${[...input.photoCredits].sort(compareText).map(escapeMarkdown).join(', ')}.`, '');
  }

  const hasImages = recipes.some((r) => images[r.id]);
  const subtitle = `${recipes.length} ${recipes.length === 1 ? 'recipe' : 'recipes'} · ${longDate}`;
  // Pandoc parses YAML string values as Markdown, so escape before quoting.
  const y = (s: string) => JSON.stringify(escapeMarkdown(s));
  const metadata = [
    '---',
    `title: ${y(kitchen.name)}`,
    `subtitle: ${y(subtitle)}`,
    'creator:',
    '  - role: author',
    '    text: Pantry Host',
    'publisher: Pantry Host',
    `date: ${date}`,
    'lang: en-US',
    'identifier:',
    '  - scheme: URN',
    `    text: urn:pantryhost:kitchen:${kitchen.slug}`,
    `description: ${y(`${counts} from the ${kitchen.name} kitchen.`)}`,
    `accessModes: [textual${hasImages ? ', visual' : ''}]`,
    'accessModeSufficient: [textual]',
    `accessibilityFeatures: [tableOfContents, readingOrder, structuralNavigation${hasImages ? ', alternativeText' : ''}]`,
    'accessibilityHazards: [none]',
    `accessibilitySummary: ${y(`Each recipe is its own chapter with headed Ingredients and Instructions lists.${hasImages ? ' Photos are decorative; the recipe text carries all information.' : ''}`)}`,
    '---',
    '',
  ].join('\n');

  return {
    markdown: out.join('\n'),
    metadata,
    css: BOOK_CSS,
    subtitle,
    recipes,
    splitLevel: grouped ? 2 : 1,
    tocDepth: grouped ? 2 : 1,
  };
}

/** No fonts or colors: the reader's own settings (and dark mode) win. */
export const BOOK_CSS = `h1, h2 { line-height: 1.2; }
h1 { margin: 0 0 0.5em; }
h2.unlisted, h3.unlisted { font-size: 1em; margin: 1.25em 0 0.4em; text-transform: uppercase; letter-spacing: 0.05em; }
img.photo { display: block; width: 100%; max-width: 30em; height: auto; margin: 0 auto 1em; }
div.meta { font-size: 0.9em; margin: 0 0 1em; }
ul, ol { margin: 0 0 1em; padding-left: 1.5em; }
li { margin: 0.2em 0; }
div.source { font-size: 0.85em; margin-top: 1.5em; word-wrap: break-word; }
`;
