/**
 * Flow: Browse recipes, click into a recipe detail, scroll to the
 * "Add to List" CTA, queue it, then verify on the grocery list page.
 */
import { navigate, click, hover, scroll, screenshot, getHtml } from '../../lib/client.js';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrollDown(steps: number, pxPerStep = 300, delayMs = 1200): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await scroll('down', pxPerStep);
    await wait(delayMs);
  }
}

export default async function queueRecipeFlow(): Promise<void> {
  // Go to recipes page
  await navigate('/recipes#stage');
  await wait(5000);
  await screenshot('queue-01-recipes');

  // Scroll down to see recipe cards
  await scrollDown(2);
  await wait(2000);
  await screenshot('queue-02-recipes-scrolled');

  // Hover then click into the first recipe card
  const html = await getHtml('main', 8);
  const slugs = [...html.matchAll(/href="\/recipes\/([a-z0-9-]+)#stage"/g)]
    .map(m => m[1])
    .filter(s => !['import', 'new', 'export'].includes(s));

  if (slugs.length > 0) {
    const sel = `a[href="/recipes/${slugs[0]}#stage"]`;
    await hover({ selector: sel });
    await wait(400);
    await click({ selector: sel });
    await wait(4000);
    await screenshot('queue-03-recipe-detail');

    // Peek at the recipe — slow scroll down to glimpse ingredients/instructions
    await scrollDown(3, 200, 1000);
    await wait(1500);

    // Scroll back up to #stage area (just enough to show the CTA)
    await scroll('up', 600);
    await wait(1500);
    await screenshot('queue-04-back-at-stage');
  }

  // Hover then click "+ Grocery List" (recipes are guaranteed un-queued by record-one.ts)
  const addSel = '[aria-label="Add to grocery list"]';
  await hover({ selector: addSel });
  await wait(400);
  await click({ selector: addSel });
  await wait(2500);
  await screenshot('queue-05-added');

  // Navigate to the grocery list page
  await navigate('/list#stage');
  await wait(4000);
  await screenshot('queue-06-list');

  // Check off the first two ingredients for a sense of completion
  try {
    await click({ selector: 'input[type="checkbox"]:not(:checked)' });
    await wait(100);
    await click({ selector: 'input[type="checkbox"]:not(:checked)' });
  } catch {}
  await wait(6000);
}
