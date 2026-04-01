/**
 * Full marketing demo flow — composes individual journey scripts.
 * Each journey is self-contained and navigates to its own starting point.
 */
import { navigate, scroll, screenshot, type, getHtml } from '../lib/client.js';
import queueRecipeFlow from './flows/queue-recipe.js';
import smoothieBowlFlow from './flows/smoothie-bowl.js';
import recipeSearchFlow from './flows/recipe-search.js';
import thisWeekMenuFlow from './flows/this-week-menu.js';
import importRecipeFlow from './flows/import-recipe.js';
import bulkImportFlow from './flows/bulk-import.js';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrollDown(steps: number, pxPerStep = 300, delayMs = 800): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await scroll('down', pxPerStep);
    await wait(delayMs);
  }
}

/**
 * The "tour" flow — a broad overview of the app.
 * Individual flows below cover specific features in depth.
 */
export async function tourFlow(): Promise<void> {
  // Homepage
  await navigate('/');
  await wait(3000);
  await screenshot('tour-01-homepage-top');
  await scrollDown(4);
  await screenshot('tour-02-homepage-bottom');

  // Recipe detail
  const html = await getHtml('#stage', 6);
  const slugs = [...html.matchAll(/href="\/recipes\/([a-z0-9-]+)#stage"/g)]
    .map(m => m[1])
    .filter(s => !['import', 'new', 'export'].includes(s));

  if (slugs.length > 0) {
    await navigate(`/recipes/${slugs[0]}`);
    await wait(3000);
    await screenshot('tour-03-recipe-top');
    await scrollDown(5);
    await screenshot('tour-04-recipe-bottom');
  }

  // Pantry
  await navigate('/ingredients');
  await wait(3000);
  await screenshot('tour-05-pantry');

  // Recipes + search
  await navigate('/recipes');
  await wait(2000);
  await screenshot('tour-06-recipes-top');
  await scrollDown(3);
  await scroll('up', 2000);
  await wait(500);
  await type({ selector: '#recipe-search' }, 'vegan');
  await wait(1500);
  await screenshot('tour-07-search');

  // Grocery list
  await navigate('/list');
  await wait(2000);
  await screenshot('tour-08-grocery-list');

  // Closing
  await navigate('/');
  await wait(2000);
  await screenshot('tour-09-final');
}

/** All named flows that can be recorded individually. */
export const FLOWS: Record<string, () => Promise<void>> = {
  tour: tourFlow,
  'queue-recipe': queueRecipeFlow,
  'smoothie-bowl': smoothieBowlFlow,
  'recipe-search': recipeSearchFlow,
  'this-week-menu': thisWeekMenuFlow,
  'import-recipe': importRecipeFlow,
  'bulk-import': bulkImportFlow,
};

/** Default export runs the tour for backwards compatibility. */
export default tourFlow;
