/**
 * Smoke test: Add ingredient flow works end-to-end.
 * Opens the add form, fills it, submits, verifies, then cleans up.
 */
import { navigate, click, type, assertVisible, getText } from '../lib/client.js';
import { assertIncludes } from '../lib/assertions.js';

const TEST_INGREDIENT = `_witness_test_${Date.now()}`;

export default async function addIngredientTest(): Promise<void> {
  await navigate('/ingredients');
  await new Promise(r => setTimeout(r, 2000));

  // Click the "+ Add Item" button
  await click({ text: '+ Add Item' });
  await new Promise(r => setTimeout(r, 1000));

  // Fill in the name field by targeting the "Name" label
  await type({ text: 'Name' }, TEST_INGREDIENT);
  await new Promise(r => setTimeout(r, 500));

  // Submit the form
  await click({ selector: 'button[type="submit"]' });
  await new Promise(r => setTimeout(r, 3000));

  // Verify the ingredient appears on the page
  const pageText = await getText({ selector: 'main' });
  assertIncludes(pageText, TEST_INGREDIENT, 'New ingredient should appear on the pantry page');

  // Clean up: delete the test ingredient
  try {
    await click({ text: TEST_INGREDIENT });
    await new Promise(r => setTimeout(r, 500));
    await click({ text: 'Delete' });
    await new Promise(r => setTimeout(r, 500));
    await click({ text: 'Confirm' });
  } catch {
    console.warn(`  [add-ingredient] Could not clean up test ingredient "${TEST_INGREDIENT}"`);
  }
}
