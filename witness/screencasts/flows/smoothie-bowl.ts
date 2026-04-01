/**
 * Flow: Navigate to Banana Blueberry Peanut Butter Smoothie Bowls recipe,
 * show featured tags, scroll to "I Made This", mark as cooked,
 * and update pantry quantities.
 */
import { navigate, click, scroll, screenshot, assertVisible, type } from '../../lib/client.js';

function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function scrollDown(steps: number, pxPerStep = 300, delayMs = 800): Promise<void> {
  for (let i = 0; i < steps; i++) {
    await scroll('down', pxPerStep);
    await wait(delayMs);
  }
}

export default async function smoothieBowlFlow(): Promise<void> {
  // Navigate directly to the smoothie bowl recipe
  await navigate('/recipes/banana-blueberry-peanut-butter-smoothie-bowls');
  await wait(3000);
  await screenshot('smoothie-01-top');

  // Scroll down to show the featured tags and ingredients
  await scrollDown(3);
  await screenshot('smoothie-02-ingredients');

  // Continue scrolling to the instructions
  await scrollDown(3);
  await screenshot('smoothie-03-instructions');

  // Scroll to "I Made This" section
  await scrollDown(3);
  await screenshot('smoothie-04-made-this');

  // Click "I Made This" button
  await click({ text: 'I Made This' });
  await wait(2000);
  await screenshot('smoothie-05-update-pantry-modal');

  // The "Update Pantry" modal should appear with ingredient quantities
  // Find the Bananas input and decrement by 1
  // The modal shows inputs with aria-label "Quantity for {name}"
  try {
    await type({ selector: '[aria-label="Quantity for Bananas"]' }, '6');
    await wait(500);

    // Update Greek Yogurt quantity
    await type({ selector: '[aria-label*="Quantity for"][aria-label*="YOGURT"], [aria-label*="Quantity for"][aria-label*="Yogurt"], [aria-label*="Quantity for"][aria-label*="yogurt"]' }, '1.5');
    await wait(500);
    await screenshot('smoothie-06-quantities-updated');

    // Click Save
    await click({ text: 'Save' });
    await wait(1500);
    await screenshot('smoothie-07-saved');
  } catch {
    // Modal may not appear if recipe has no pantry-matching ingredients
    // Click Skip if present
    try { await click({ text: 'Skip' }); } catch {}
    await screenshot('smoothie-07-skipped');
  }
}
