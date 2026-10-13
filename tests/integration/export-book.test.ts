import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { harness } from './helpers/harness.ts';
import { gql } from './helpers/gql.ts';
import { resetDb } from './helpers/reset.ts';

// The publish-kitchen skill's book builder (packages/shared/src/export-book.ts)
// and the script that turns it into an EPUB (packages/app/scripts/publish-book.ts).
const REPO = join(import.meta.dirname, '..', '..');
const TSX = join(REPO, 'node_modules', '.bin', 'tsx');
const DRIVER = join(import.meta.dirname, 'helpers', 'export-book-driver.ts');

interface Book {
  markdown: string;
  metadata: string;
  subtitle: string;
  splitLevel: number;
  tocDepth: number;
}

function drive(input: unknown): { book: Book | null; escaped: string[]; quantities: string[] } {
  const r = spawnSync(TSX, [DRIVER], { input: JSON.stringify(input), encoding: 'utf8', timeout: 60_000 });
  assert.equal(r.status, 0, r.stderr);
  return JSON.parse(r.stdout);
}

function recipe(id: string, title: string, extra: Record<string, unknown> = {}) {
  return {
    id, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title,
    description: null, instructions: 'Stir.\nServe.', servings: null, prepTime: null, cookTime: null,
    tags: [], requiredCookware: [], sourceUrl: null, photoUrl: null, ingredients: [],
    ...extra,
  };
}

describe('export-book: Markdown for pandoc', () => {
  it('escapes Markdown so recipe text stays literal', () => {
    const { escaped } = drive({ escape: ['1. *Best* Chili [v2]', 'Mac &\n Cheese # 2'] });
    assert.deepEqual(escaped, ['1\\. \\*Best\\* Chili \\[v2\\]', 'Mac \\& Cheese \\# 2']);
  });

  it('prints common fractions as cooks write them', () => {
    const { quantities } = drive({ quantities: [0.5, 1.25, 2, 0.333, 0.4, 2.75] });
    assert.deepEqual(quantities, ['½', '1¼', '2', '⅓', '0.4', '2¾']);
  });

  it('builds menus by course, links sub-recipes, and skips inactive menus', () => {
    const dough = recipe('r1', 'Pizza Dough');
    const pizza = recipe('r2', 'Margherita Pizza', {
      tags: ['dinner'],
      sourceUrl: 'at://did:plc:abc/exchange.recipe.recipe/3k',
      ingredients: [
        { ingredientName: 'pizza dough', quantity: 1, unit: null, itemSize: null, itemSizeUnit: null, sourceRecipeId: 'r1' },
        { ingredientName: 'mozzarella', quantity: 0.5, unit: 'cup', itemSize: null, itemSizeUnit: null, sourceRecipeId: null },
      ],
    });
    const lemonade = recipe('r3', 'Lemonade', { tags: ['drink', 'beverage'] });
    const { book } = drive({
      book: {
        kitchen: { slug: 'test', name: 'Test Kitchen' },
        recipes: [pizza, lemonade, dough],
        menus: [
          { id: 'm1', title: 'Friday', description: null, active: true, recipes: [
            { course: 'main-course', sortOrder: 0, recipe: { id: 'r2', title: 'Margherita Pizza', tags: ['dinner'] } },
            { course: null, sortOrder: 1, recipe: { id: 'r3', title: 'Lemonade', tags: ['drink', 'beverage'] } },
          ] },
          { id: 'm2', title: 'Retired Menu', description: null, active: false, recipes: [] },
        ],
        date: '2026-10-12',
      },
    });
    assert.ok(book);
    const md = book.markdown;
    assert.match(md, /^# Menus \{#menus\}/);
    assert.match(md, /### Main Course \{\.unlisted\}\n\n- \[Margherita Pizza\]\(#recipe-margherita-pizza\)/);
    // No course set: inferred from the "beverage" tag, like the menu page.
    assert.match(md, /### Beverages \{\.unlisted\}\n\n- \[Lemonade\]\(#recipe-lemonade\)/);
    assert.doesNotMatch(md, /Retired Menu/);
    assert.match(md, /- \[1 pizza dough\]\(#recipe-pizza-dough\)/);
    assert.match(md, /- ½ cup mozzarella/);
    assert.match(md, /Source: \[Bluesky\]\(https:\/\/my\.pantryhost\.app\/at\/did:plc:abc\/exchange\.recipe\.recipe\/3k\)/);
    // A–Z: Lemonade, Margherita Pizza, Pizza Dough.
    assert.ok(md.indexOf('# Lemonade') < md.indexOf('# Margherita Pizza'));
    assert.ok(md.indexOf('# Margherita Pizza') < md.indexOf('# Pizza Dough'));
    assert.equal(book.splitLevel, 1);
    assert.equal(book.subtitle, '3 recipes · October 12, 2026');
    assert.match(book.metadata, /text: urn:pantryhost:kitchen:test/);
    assert.match(book.metadata, /accessModeSufficient: \[textual\]/);
  });

  it('groups large kitchens under A–Z headings', () => {
    const recipes = Array.from({ length: 41 }, (_, n) => recipe(`r${n}`, `${String.fromCharCode(65 + (n % 26))} Dish ${n}`));
    recipes.push(recipe('r99', '7-Layer Dip'));
    const { book } = drive({ book: { kitchen: { slug: 'big', name: 'Big' }, recipes, menus: [], date: '2026-10-12' } });
    assert.ok(book);
    assert.equal(book.splitLevel, 2);
    assert.equal(book.tocDepth, 2);
    assert.match(book.markdown, /^# 0–9 \{#letter-other\}\n\n## 7\\-Layer Dip/m);
    assert.match(book.markdown, /^# A \{#letter-a\}\n\n## A Dish 0 /m);
  });
});

const pandoc = spawnSync('pandoc', ['--version'], { encoding: 'utf8' });
const hasPandoc = pandoc.status === 0 && Number(/pandoc\S* (\d+)/.exec(pandoc.stdout)?.[1] ?? 0) >= 3;

describe('publish-book.ts: a kitchen becomes an EPUB', { skip: hasPandoc ? false : 'pandoc 3+ not installed' }, () => {
  let out: string;

  before(async () => {
    await resetDb();
    out = mkdtempSync(join(tmpdir(), 'publish-book-test-'));
    await gql(`mutation { createKitchen(slug: "books", name: "Book Club") { id } }`);
    const { createRecipe } = await gql<{ createRecipe: { id: string } }>(
      `mutation { createRecipe(title: "Shortbread", instructions: "Cream.\\nBake.", kitchenSlug: "books", tags: ["baking"],
        ingredients: [{ ingredientName: "butter", quantity: 0.5, unit: "cup" }]) { id } }`,
    );
    await gql(
      `mutation { createRecipe(title: "Tea & Toast", instructions: "Steep.", kitchenSlug: "books", ingredients: []) { id } }`,
    );
    await gql(
      `mutation M($id: String!) { createMenu(title: "Tea Time", kitchenSlug: "books", recipes: [{ recipeId: $id, course: "dessert" }]) { id } }`,
      { id: createRecipe.id },
    );
  });

  after(() => rmSync(out, { recursive: true, force: true }));

  it('writes a valid EPUB with every recipe in its table of contents', () => {
    const r = spawnSync(TSX, [join(REPO, 'packages', 'app', 'scripts', 'publish-book.ts'), '--kitchen', 'books', '--photos', 'none', '--out', out], {
      encoding: 'utf8',
      timeout: 120_000,
      env: { ...process.env, GRAPHQL_URL: `${harness().url}/graphql` },
    });
    assert.equal(r.status, 0, r.stderr);
    const { books } = JSON.parse(r.stdout) as { books: { file: string; recipes: number; menus: number; missingPhotos: unknown[] }[] };
    assert.equal(books.length, 1);
    const [book] = books;
    assert.equal(book.recipes, 2);
    assert.equal(book.menus, 1);
    assert.ok(existsSync(book.file) && book.file.endsWith('pantry-host-books.epub'));

    // EPUB's first entry must be the uncompressed "mimetype" file.
    const list = spawnSync('unzip', ['-Z1', book.file], { encoding: 'utf8' });
    assert.equal(list.stdout.split('\n')[0], 'mimetype');
    assert.equal(spawnSync('unzip', ['-tq', book.file]).status, 0);
    const nav = spawnSync('unzip', ['-p', book.file, 'EPUB/nav.xhtml'], { encoding: 'utf8' }).stdout;
    for (const title of ['Menus', 'Shortbread', 'Tea &amp; Toast', 'Index by Tag', 'About This Book']) {
      assert.ok(nav.includes(`>${title}</a>`), `nav lists ${title}`);
    }
  });
});
