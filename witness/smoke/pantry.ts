/**
 * Smoke test: Ingredients page loads with items
 */
import { navigate, assertVisible, getText } from '../lib/client.js';
import { assertGreaterThan } from '../lib/assertions.js';

export default async function pantryTest(): Promise<void> {
  await navigate('/ingredients');

  // Page title
  await assertVisible({ selector: 'h1' });

  // Wait for ingredients to load (category headings appear)
  // Give it a moment for GraphQL to respond
  await assertVisible({ selector: 'h2' });

  // Should have ingredient items
  const pageText = await getText({ selector: '#stage, main' });
  assertGreaterThan(pageText.length, 50, 'Pantry page should have content (ingredients loaded)');
}
