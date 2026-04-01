/**
 * Smoke test: Recipe detail page renders title and content
 */
import { navigate, assertVisible, getText, getHtml } from '../lib/client.js';
import { assert, assertGreaterThan } from '../lib/assertions.js';

export default async function recipeDetailTest(): Promise<void> {
  // Go to recipes index and wait for data
  await navigate('/recipes#stage');
  await new Promise(r => setTimeout(r, 3000));

  // Find a recipe slug from the page HTML
  const html = await getHtml('main', 8);
  const slugMatch = html.match(/href="\/recipes\/([a-z0-9-]+)#stage"/);
  // Skip utility links (import, new, export)
  const allSlugs = [...html.matchAll(/href="\/recipes\/([a-z0-9-]+)#stage"/g)]
    .map(m => m[1])
    .filter(s => !['import', 'new', 'export'].includes(s));

  assert(allSlugs.length > 0, 'Should find at least one recipe link on /recipes');

  // Navigate to the recipe detail
  await navigate(`/recipes/${allSlugs[0]}#stage`);
  await new Promise(r => setTimeout(r, 2000));

  // Title should be visible
  await assertVisible({ selector: 'h1' });
  const title = await getText({ selector: 'h1' });
  assertGreaterThan(title.length, 0, 'Recipe title should not be empty');

  // Page should have substantial content (ingredients, instructions)
  const pageText = await getText({ selector: '#stage, main' });
  assert(pageText.length > 50, 'Recipe detail page should have substantial content');
}
