/**
 * Smoke test: Dashboard loads with ingredient/recipe counts > 0
 */
import { navigate, getText, assertVisible } from '../lib/client.js';
import { assert, assertGreaterThan } from '../lib/assertions.js';

export default async function homepageTest(): Promise<void> {
  await navigate('/');

  // Hero heading is visible
  await assertVisible({ selector: '#hero-heading' });

  // Wait for GraphQL data to load
  await new Promise(r => setTimeout(r, 3000));

  // Pantry summary section exists with stats
  await assertVisible({ selector: '[aria-label="Pantry summary"]' });

  // Stats text looks like "171Ingredients79Recipes70Spices43Pantry Items"
  const statsText = await getText({ selector: '[aria-label="Pantry summary"]' });
  const numbers = statsText.match(/\d+/g)?.map(Number) ?? [];
  assertGreaterThan(numbers.length, 0, 'Should have stat numbers on dashboard');
  assert(numbers.some(n => n > 0), 'Dashboard stats should have at least one positive count');
}
