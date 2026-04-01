/**
 * Flow: Bulk import multiple recipes by pasting several URLs.
 */
import { navigate, click, type, scroll, screenshot } from '../../lib/client.js';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const RECIPE_URLS = [
  'https://www.allrecipes.com/recipe/10813/best-chocolate-chip-cookies/',
  'https://www.allrecipes.com/recipe/24002/simple-macaroni-and-cheese/',
  'https://www.allrecipes.com/recipe/23891/grilled-cheese-sandwich/',
].join('\n');

export default async function bulkImportFlow(): Promise<void> {
  // Go to recipe import page
  await navigate('/recipes/import');
  await wait(2000);
  await screenshot('bulk-01-page');

  // Scroll to the paste section
  await scroll('down', 300);
  await wait(500);

  // Paste multiple URLs
  await type({ selector: '[aria-label="Recipe URLs or file content"]' }, RECIPE_URLS);
  await wait(1000);
  await screenshot('bulk-02-urls-pasted');

  // Click "Parse URLs"
  await click({ text: 'Parse URLs →' });
  await wait(3000);
  await screenshot('bulk-03-fetching');

  // Wait for all fetches to complete (3 recipes, batched)
  await wait(10000);
  await screenshot('bulk-04-review');

  // Scroll to see all parsed recipes
  await scroll('down', 400);
  await wait(800);
  await screenshot('bulk-05-review-scrolled');
}
