import { describe, it, before } from 'node:test';
import { strict as assert } from 'node:assert';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { harness } from './helpers/harness.ts';
import { gql } from './helpers/gql.ts';
import { resetDb } from './helpers/reset.ts';

interface CreatedRecipe { createRecipe: { slug: string } }
interface CreatedMenu { createMenu: { slug: string } }

async function getHtml(path: string): Promise<{ status: number; html: string; redirect: string | null }> {
  const { url } = harness();
  const r = await fetch(`${url}${path}`, { redirect: 'manual' });
  return {
    status: r.status,
    html: await r.text(),
    redirect: r.headers.get('location'),
  };
}

describe('GET /kitchens/home/* → / 308 redirect', () => {
  it('bare /kitchens/home redirects to /', async () => {
    const { status, redirect } = await getHtml('/kitchens/home');
    assert.equal(status, 308);
    assert.equal(redirect, '/');
  });

  it('trailing-slash /kitchens/home/ redirects to /', async () => {
    const { status, redirect } = await getHtml('/kitchens/home/');
    assert.equal(status, 308);
    assert.equal(redirect, '/');
  });

  it('/kitchens/home/recipes → /recipes (nested paths preserved)', async () => {
    const { status, redirect } = await getHtml('/kitchens/home/recipes');
    assert.equal(status, 308);
    assert.equal(redirect, '/recipes');
  });

  it('/kitchens/home/at/did:plc:foo/exchange.recipe.recipe/abc → /at/...', async () => {
    const { status, redirect } = await getHtml(
      '/kitchens/home/at/did:plc:foo/exchange.recipe.recipe/abc',
    );
    assert.equal(status, 308);
    assert.equal(redirect, '/at/did:plc:foo/exchange.recipe.recipe/abc');
  });

  it('preserves the query string (which the Rex middleware lost)', async () => {
    const { url } = harness();
    const r = await fetch(`${url}/kitchens/home/recipes?favorites=1`, { redirect: 'manual' });
    assert.equal(r.status, 308);
    assert.equal(r.headers.get('location'), '/recipes?favorites=1');
  });

  it('non-home kitchens are NOT redirected — /kitchens/bar/recipes renders normally', async () => {
    const { status, redirect, html } = await getHtml('/kitchens/bar/recipes');
    assert.equal(status, 200);
    assert.equal(redirect, null);
    assert.ok(html.includes('<div id="__rex"></div>'), 'served the SPA shell');
  });
});

describe('SPA shell injects OG metadata for detail pages', () => {
  let recipeSlug = '';
  let menuSlug = '';

  before(async () => {
    await resetDb();
    const r = await gql<CreatedRecipe>(
      `mutation Create(
        $title: String!,
        $description: String,
        $instructions: String!,
        $tags: [String!],
        $photoUrl: String,
        $ingredients: [RecipeIngredientInput!]!,
      ) {
        createRecipe(
          title: $title,
          description: $description,
          instructions: $instructions,
          tags: $tags,
          photoUrl: $photoUrl,
          ingredients: $ingredients,
        ) { slug }
      }`,
      {
        title: 'OG Test Casserole',
        description: 'A casserole used in integration tests',
        instructions: '1. Mix\n2. Bake',
        tags: ['dinner'],
        photoUrl: '/uploads/og-test.jpg',
        ingredients: [{ ingredientName: 'cheese', quantity: 1, unit: 'cup' }],
      },
    );
    recipeSlug = r.createRecipe.slug;

    const m = await gql<CreatedMenu>(
      `mutation CreateMenu($title: String!, $description: String, $recipes: [String!]!) {
        createMenu(title: $title, description: $description, recipes: $recipes) { slug }
      }`,
      {
        title: 'OG Test Menu',
        description: 'Menu used in integration tests',
        recipes: [],
      },
    );
    menuSlug = m.createMenu.slug;
  });

  it('/recipes/:slug emits title + og:* + twitter:card from the DB row', async () => {
    const { status, html } = await getHtml(`/recipes/${recipeSlug}`);
    assert.equal(status, 200);
    assert.ok(html.includes('<title>OG Test Casserole — Pantry Host</title>'));
    assert.ok(html.includes('<meta property="og:title" content="OG Test Casserole — Pantry Host">'));
    assert.ok(html.includes('<meta property="og:type" content="article">'));
    assert.ok(html.includes(
      '<meta property="og:description" content="A casserole used in integration tests">',
    ));
    assert.ok(html.includes('<meta name="description" content="A casserole used in integration tests">'));
    // Photo URL is /uploads/… and should be absolutized via the request's host.
    assert.match(
      html,
      /<meta property="og:image" content="http:\/\/127\.0\.0\.1:\d+\/uploads\/og-test\.jpg">/,
    );
    assert.ok(html.includes('<meta name="twitter:card" content="summary_large_image">'));
  });

  it('/menus/:slug emits og:type=website (vs article for recipes)', async () => {
    const { status, html } = await getHtml(`/menus/${menuSlug}`);
    assert.equal(status, 200);
    assert.ok(html.includes('<title>OG Test Menu — Pantry Host</title>'));
    assert.ok(html.includes('<meta property="og:type" content="website">'));
    assert.ok(html.includes(
      '<meta property="og:description" content="Menu used in integration tests">',
    ));
    // No photoUrl on this menu — twitter:card falls back to `summary`.
    assert.ok(html.includes('<meta name="twitter:card" content="summary">'));
    assert.ok(!html.includes('<meta property="og:image"'), 'no og:image without a photo');
  });

  it('/kitchens/home/recipes/<slug> redirects to /recipes/<slug>, not OG-injected at the old URL', async () => {
    const { status, redirect } = await getHtml(`/kitchens/home/recipes/${recipeSlug}`);
    assert.equal(status, 308);
    assert.equal(redirect, `/recipes/${recipeSlug}`);
  });

  it('/kitchens/<other>/recipes/:slug injects OG meta', async () => {
    // Create a non-home kitchen + a recipe in it, then verify the
    // kitchen-scoped URL also gets OG meta.
    await gql<{ createKitchen: { slug: string } }>(
      `mutation($s: String!, $n: String!) { createKitchen(slug: $s, name: $n) { slug } }`,
      { s: 'og-test-kitchen', n: 'OG Test Kitchen' },
    );
    const r = await gql<CreatedRecipe>(
      `mutation Create(
        $title: String!,
        $description: String,
        $instructions: String!,
        $kitchenSlug: String,
        $ingredients: [RecipeIngredientInput!]!,
      ) {
        createRecipe(
          title: $title,
          description: $description,
          instructions: $instructions,
          kitchenSlug: $kitchenSlug,
          ingredients: $ingredients,
        ) { slug }
      }`,
      {
        title: 'Kitchen-Scoped Salad',
        description: 'Lives in og-test-kitchen',
        instructions: 'Toss',
        kitchenSlug: 'og-test-kitchen',
        ingredients: [{ ingredientName: 'lettuce', quantity: 1, unit: 'head' }],
      },
    );
    const { status, html } = await getHtml(
      `/kitchens/og-test-kitchen/recipes/${r.createRecipe.slug}`,
    );
    assert.equal(status, 200);
    assert.ok(html.includes('<title>Kitchen-Scoped Salad — Pantry Host</title>'));
    assert.ok(html.includes('<meta property="og:type" content="article">'));
  });

  it('reserved page bundles (/recipes/new, /recipes/import, …) skip the DB lookup', async () => {
    const { status, html } = await getHtml('/recipes/new');
    assert.equal(status, 200);
    // Generic title, no og:title — these are not detail pages, so the
    // reserved-segment guard short-circuits the lookup. The page bundle
    // (recipes-new-*.js) is what actually picks the right component.
    assert.ok(html.includes('<title>Pantry Host</title>'));
    assert.ok(!html.includes('<meta property="og:title"'));
  });

  it('unknown slug yields the shell with the og:type set but no title/description', async () => {
    const { status, html } = await getHtml('/recipes/this-slug-does-not-exist');
    assert.equal(status, 200);
    // og_type is set ("article") but title/description/image are all
    // null, so render_og returns just the generic title with the
    // og:type tag absent — render_og only emits OG metas when at least
    // one of title/description/image is present.
    assert.ok(html.includes('<title>Pantry Host</title>'));
    assert.ok(!html.includes('<meta property="og:title"'));
  });
});

describe('SPA shell seeds initialData from the shared page-data table', () => {
  const TRICKY_TITLE = 'Index Test </script><!-- Mac & Cheese';
  const PAGE_DATA = JSON.parse(
    readFileSync(join(import.meta.dirname, '../../packages/shared/src/page-data.json'), 'utf8'),
  ) as { queries: Record<string, string>; routes: Array<{ route: string; query: string; variables: Record<string, string> }> };

  let homeRecipe = { id: '', slug: '' };
  let kitchenRecipe = { id: '', slug: '' };
  let menuSlug = '';
  let cookwareId = '';

  function pageProps(html: string): { initialData?: Record<string, unknown> } {
    const m = html.match(/<script id="__REX_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
    assert.ok(m, '__REX_DATA__ script present');
    return JSON.parse(m[1]);
  }

  /** What the page's own client-side query returns for this route + params. */
  async function clientData(route: string, params: Record<string, string>): Promise<unknown> {
    const row = PAGE_DATA.routes.find((r) => r.route === route);
    assert.ok(row, `page-data row for ${route}`);
    const variables = Object.fromEntries(
      Object.entries(row.variables).map(([k, v]) => [k, v.startsWith(':') ? params[v.slice(1)] : v]),
    );
    return gql(PAGE_DATA.queries[row.query], variables);
  }

  async function createRecipe(title: string, kitchenSlug?: string): Promise<{ id: string; slug: string }> {
    const r = await gql<{ createRecipe: { id: string; slug: string } }>(
      `mutation Create($title: String!, $instructions: String!, $kitchenSlug: String, $ingredients: [RecipeIngredientInput!]!) {
        createRecipe(title: $title, instructions: $instructions, kitchenSlug: $kitchenSlug, ingredients: $ingredients) { id slug }
      }`,
      { title, instructions: '1. Cook', kitchenSlug, ingredients: [{ ingredientName: 'eggs', quantity: 2, unit: 'whole' }] },
    );
    return r.createRecipe;
  }

  before(async () => {
    await resetDb();
    homeRecipe = await createRecipe(TRICKY_TITLE);
    await gql(`mutation($id: String!) { toggleRecipeQueued(id: $id) { id } }`, { id: homeRecipe.id });
    for (const [s, n] of [['index-test-kitchen', 'Index Test Kitchen'], ['index-empty-kitchen', 'Empty Kitchen']]) {
      await gql(`mutation($s: String!, $n: String!) { createKitchen(slug: $s, name: $n) { slug } }`, { s, n });
    }
    kitchenRecipe = await createRecipe('Kitchen-Scoped Index Soup', 'index-test-kitchen');
    const m = await gql<CreatedMenu>(
      `mutation($title: String!, $recipes: [MenuRecipeInput!]!) { createMenu(title: $title, recipes: $recipes) { slug } }`,
      { title: 'Index Test Menu', recipes: [{ recipeId: homeRecipe.id }] },
    );
    menuSlug = m.createMenu.slug;
    const c = await gql<{ addCookware: { id: string } }>(
      `mutation($name: String!) { addCookware(name: $name) { id } }`,
      { name: 'Index Test Skillet' },
    );
    cookwareId = c.addCookware.id;
    await gql(`mutation($name: String!) { addIngredient(name: $name) { id } }`, { name: 'Index Test Eggs' });
  });

  it('/recipes ships the home kitchen list, script-safe', async () => {
    const { status, html } = await getHtml('/recipes');
    assert.equal(status, 200);
    const recipes = pageProps(html).initialData?.recipes as Array<{ title: string }>;
    assert.deepEqual(recipes.map((r) => r.title), [TRICKY_TITLE]);
    // The title's </script> must not terminate the data script early.
    assert.ok(!html.includes('</script><!-- Mac'), 'raw title not inlined');
  });

  it('every list route matches its client-side query, home and kitchen-scoped', async () => {
    const cases: Array<[string, string, Record<string, string>]> = [
      ['/', '/', {}],
      ['/kitchens/index-test-kitchen', '/kitchens/:kitchen', { kitchen: 'index-test-kitchen' }],
      ['/recipes', '/recipes', {}],
      ['/kitchens/index-test-kitchen/recipes', '/kitchens/:kitchen/recipes', { kitchen: 'index-test-kitchen' }],
      ['/menus', '/menus', {}],
      ['/kitchens/index-test-kitchen/menus', '/kitchens/:kitchen/menus', { kitchen: 'index-test-kitchen' }],
      ['/cookware', '/cookware', {}],
      ['/kitchens/index-test-kitchen/cookware', '/kitchens/:kitchen/cookware', { kitchen: 'index-test-kitchen' }],
      ['/ingredients', '/ingredients', {}],
      ['/kitchens/index-test-kitchen/ingredients', '/kitchens/:kitchen/ingredients', { kitchen: 'index-test-kitchen' }],
      ['/list', '/list', {}],
      ['/kitchens/index-test-kitchen/list', '/kitchens/:kitchen/list', { kitchen: 'index-test-kitchen' }],
    ];
    for (const [url, route, params] of cases) {
      const { status, html } = await getHtml(url);
      assert.equal(status, 200, url);
      assert.deepEqual(pageProps(html).initialData, await clientData(route, params), url);
    }
  });

  it('seeded lists contain the fixtures (not just two empty answers)', async () => {
    const list = pageProps((await getHtml('/list')).html).initialData as { recipes: Array<{ title: string }>; ingredients: unknown[] };
    assert.deepEqual(list.recipes.map((r) => r.title), [TRICKY_TITLE], 'queued recipe on /list');
    assert.ok(list.ingredients.length >= 1, 'pantry on /list');
    const menus = pageProps((await getHtml('/menus')).html).initialData as { menus: Array<{ title: string }> };
    assert.deepEqual(menus.menus.map((m) => m.title), ['Index Test Menu']);
    const cookware = pageProps((await getHtml('/cookware')).html).initialData as { cookware: Array<{ name: string }> };
    assert.deepEqual(cookware.cookware.map((c) => c.name), ['Index Test Skillet']);
  });

  it('detail routes match their client-side query', async () => {
    const cases: Array<[string, string, Record<string, string>]> = [
      [`/recipes/${homeRecipe.slug}`, '/recipes/:slug', { slug: homeRecipe.slug }],
      [`/kitchens/index-test-kitchen/recipes/${kitchenRecipe.slug}`, '/kitchens/:kitchen/recipes/:slug', { kitchen: 'index-test-kitchen', slug: kitchenRecipe.slug }],
      [`/menus/${menuSlug}`, '/menus/:slug', { slug: menuSlug }],
      [`/cookware/${cookwareId}`, '/cookware/:id', { id: cookwareId }],
    ];
    for (const [url, route, params] of cases) {
      const data = pageProps((await getHtml(url)).html).initialData as Record<string, { title?: string; name?: string } | null>;
      assert.deepEqual(data, await clientData(route, params), url);
      assert.ok(Object.values(data)[0], `${url} resolved a record`);
    }
  });

  it('an empty kitchen ships empty lists (so pages can say "No recipes yet")', async () => {
    const { html } = await getHtml('/kitchens/index-empty-kitchen/recipes');
    assert.deepEqual(pageProps(html).initialData, { recipes: [] });
  });

  it('an unknown kitchen, unlisted routes, and unknown URLs ship {}', async () => {
    assert.deepEqual(pageProps((await getHtml('/kitchens/no-such-kitchen/recipes')).html), {});
    assert.deepEqual(pageProps((await getHtml('/recipes/new')).html), {});
    assert.deepEqual(pageProps((await getHtml('/menus/feeds/bluesky')).html), {});
    assert.deepEqual(pageProps((await getHtml('/definitely/not/a/route')).html), {});
  });

  it('every table route has a Rex page whose getServerSideProps names that route', () => {
    const pagesDir = join(import.meta.dirname, '../../packages/app/pages');
    for (const { route } of PAGE_DATA.routes) {
      const rel = route === '/' ? '' : route.replace(/:([a-z]+)/gi, '[$1]');
      const candidates = [`${pagesDir}${rel}/index.tsx`, `${pagesDir}${rel}.tsx`];
      const file = candidates.find((f) => existsSync(f));
      assert.ok(file, `no page file for ${route} (tried ${candidates.join(', ')})`);
      const src = readFileSync(file, 'utf8');
      assert.ok(src.includes(`getPageData<`) && src.includes(`'${route}'`), `${file} must call getPageData('${route}', ...)`);
    }
  });
});
