/**
 * Flow: Queue a recipe to the grocery list, then verify it on /list.
 */
import { navigate, click, scroll, screenshot, assertVisible, getText } from '../../lib/client.js';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export default async function queueRecipeFlow(): Promise<void> {
  // Go to recipes page
  await navigate('/recipes');
  await wait(3000);
  await screenshot('queue-01-recipes');

  // Scroll down to find recipe cards
  await scroll('down', 400);
  await wait(1000);

  // Click the "Add to list" cart button on the first recipe card
  // The button has aria-label "Add {title} to list"
  await click({ selector: '.add-to-list-cta:not(.is-active)' });
  await wait(1500);
  await screenshot('queue-02-added');

  // Navigate to the grocery list page
  await navigate('/list');
  await wait(3000);
  await screenshot('queue-03-list-top');

  // Scroll to see the cooking queue and ingredients
  await scroll('down', 400);
  await wait(800);
  await scroll('down', 400);
  await wait(800);
  await screenshot('queue-04-list-scrolled');
}
