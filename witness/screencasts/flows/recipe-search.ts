/**
 * Flow: Search for vegan recipes using the recipe search input.
 */
import { navigate, type, scroll, screenshot } from '../../lib/client.js';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function recipeSearchFlow(): Promise<void> {
  // Go to recipes page
  await navigate('/recipes');
  await wait(3000);
  await screenshot('search-01-recipes');

  // Type "vegan" in the search input
  await type({ selector: '#recipe-search' }, 'vegan');
  await wait(1500);
  await screenshot('search-02-vegan-results');

  // Scroll through the filtered results
  await scroll('down', 400);
  await wait(800);
  await scroll('down', 400);
  await wait(800);
  await screenshot('search-03-vegan-scrolled');

  // Clear and try another term
  await type({ selector: '#recipe-search' }, 'smoothie');
  await wait(1500);
  await screenshot('search-04-smoothie-results');
}
