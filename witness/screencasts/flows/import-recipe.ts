/**
 * Flow: Import a recipe by pasting a URL and walking through the import steps.
 */
import { navigate, click, hover, type, scroll, screenshot } from '../../lib/client.js';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const RECIPE_URL = 'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/';

export default async function importRecipeFlow(): Promise<void> {
  // Go to recipe import page
  await navigate('/recipes/import');
  await wait(3000);
  await screenshot('import-01-page');

  // Scroll down to the "Or paste URLs" section
  await scroll('down', 300);
  await wait(1500);

  // Hover the textarea then paste a URL
  await hover({ selector: '[aria-label="Recipe URLs or file content"]' });
  await wait(400);
  await type({ selector: '[aria-label="Recipe URLs or file content"]' }, RECIPE_URL);
  await wait(2000);
  await screenshot('import-02-url-pasted');

  // Hover then click "Parse URLs"
  await hover({ text: 'Parse URLs →' });
  await wait(400);
  await click({ text: 'Parse URLs →' });
  await wait(6000);
  await screenshot('import-03-fetching');

  // Wait for fetching to complete
  await wait(6000);
  await screenshot('import-04-review');
}
