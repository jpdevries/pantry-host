/**
 * Flow: Navigate to menus, open "Organic Week" (this-week category),
 * scroll through the classic text menu and recipe cards.
 */
import { navigate, click, scroll, screenshot } from '../../lib/client.js';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrollDown(steps: number, pxPerStep = 300, delayMs = 800): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await scroll('down', pxPerStep);
    await wait(delayMs);
  }
}

export default async function thisWeekMenuFlow(): Promise<void> {
  // Go to menus index
  await navigate('/menus');
  await wait(3000);
  await screenshot('menu-01-index');

  // Click on "Organic Week" menu
  await click({ text: 'Organic Week' });
  await wait(3000);
  await screenshot('menu-02-detail-top');

  // Scroll down through the classic text menu
  await scrollDown(4);
  await screenshot('menu-03-classic-menu');

  // Continue scrolling past the <hr> to the recipe cards section
  await scrollDown(4);
  await screenshot('menu-04-recipe-cards');

  // Scroll further to see more recipe cards
  await scrollDown(3);
  await screenshot('menu-05-more-cards');
}
