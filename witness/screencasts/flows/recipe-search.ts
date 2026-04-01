/**
 * Flow: Search for vegan recipes using the recipe search input.
 */
import { navigate, type, hover, scroll, screenshot } from '../../lib/client.js';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function recipeSearchFlow(): Promise<void> {
  // Go to recipes page
  await navigate('/recipes#stage');
  await wait(4000);
  await screenshot('search-01-recipes');

  // Hover the search input then type
  await hover({ selector: '#recipe-search' });
  await wait(400);
  await type({ selector: '#recipe-search' }, 'vegan');
  await wait(2500);
  await screenshot('search-02-vegan-results');

  // Scroll through the filtered results
  await scroll('down', 400);
  await wait(1200);
  await scroll('down', 400);
  await wait(1200);
  await screenshot('search-03-vegan-scrolled');

  // Clear and try another term
  await hover({ selector: '#recipe-search' });
  await wait(400);
  await type({ selector: '#recipe-search' }, 'smoothie');
  await wait(2500);
  await screenshot('search-04-smoothie-results');
}
