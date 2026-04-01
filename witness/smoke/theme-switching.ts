/**
 * Smoke test: Palettes change CSS custom properties when switched via footer controls
 */
import { navigate, select, click, getHtml } from '../lib/client.js';
import { assert } from '../lib/assertions.js';

export default async function themeSwitchingTest(): Promise<void> {
  await navigate('/');

  // Switch to "claude" palette via the footer select
  await select({ selector: '[aria-label="Color palette"]' }, 'claude');

  // Switch to dark mode via the footer radio button
  await click({ text: 'Dark theme' });

  // Read the body attributes to verify theme was applied
  const htmlAfterClaude = await getHtml('body', 1);
  assert(
    htmlAfterClaude.includes('data-theme="claude"'),
    'Body should have data-theme="claude" after selecting claude palette'
  );
  assert(
    htmlAfterClaude.includes('data-color-scheme="dark"'),
    'Body should have data-color-scheme="dark" after clicking dark theme'
  );

  // Switch to "rose" palette and light mode
  await select({ selector: '[aria-label="Color palette"]' }, 'rose');
  await click({ text: 'Light theme' });

  const htmlAfterRose = await getHtml('body', 1);
  assert(
    htmlAfterRose.includes('data-theme="rose"'),
    'Body should have data-theme="rose" after selecting rose palette'
  );
  assert(
    htmlAfterRose.includes('data-color-scheme="light"'),
    'Body should have data-color-scheme="light" after clicking light theme'
  );

  // Reset to default
  await select({ selector: '[aria-label="Color palette"]' }, 'default');
  await click({ text: 'System theme' });
}
