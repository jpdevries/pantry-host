/**
 * Smoke test runner — executes all smoke tests against a running Rex + GraphQL server.
 *
 * Usage: npx tsx witness/run-smoke.ts [--base-url http://localhost:3000]
 */
import { connect, disconnect, startSession, endSession, screenshot } from './lib/client.js';
import homepageTest from './smoke/homepage.js';
import recipeDetailTest from './smoke/recipe-detail.js';
import pantryTest from './smoke/pantry.js';
import recipeSearchTest from './smoke/recipe-search.js';
import addIngredientTest from './smoke/add-ingredient.js';
import themeSwitchingTest from './smoke/theme-switching.js';

const BASE_URL = process.argv.includes('--base-url')
  ? process.argv[process.argv.indexOf('--base-url') + 1]
  : 'http://localhost:3000';

interface TestResult {
  name: string;
  passed: boolean;
  error?: string;
  duration: number;
}

const tests: Array<{ name: string; fn: () => Promise<void> }> = [
  { name: 'homepage', fn: homepageTest },
  { name: 'recipe-detail', fn: recipeDetailTest },
  { name: 'pantry', fn: pantryTest },
  { name: 'recipe-search', fn: recipeSearchTest },
  { name: 'add-ingredient', fn: addIngredientTest },
  { name: 'theme-switching', fn: themeSwitchingTest },
];

async function run() {
  console.log(`\n  Pantry Host Smoke Tests`);
  console.log(`  Base URL: ${BASE_URL}\n`);

  await connect();

  const results: TestResult[] = [];

  for (const test of tests) {
    const start = Date.now();
    try {
      await startSession(`smoke-${test.name}`, { baseUrl: BASE_URL });
      await test.fn();
      const duration = Date.now() - start;
      await endSession(`PASS: ${test.name}`);
      results.push({ name: test.name, passed: true, duration });
      console.log(`  \x1b[32m✓\x1b[0m ${test.name} (${duration}ms)`);
    } catch (err) {
      const duration = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      try {
        await screenshot(`failure-${test.name}`);
        await endSession(`FAIL: ${test.name} — ${message}`);
      } catch {}
      results.push({ name: test.name, passed: false, error: message, duration });
      console.log(`  \x1b[31m✗\x1b[0m ${test.name} (${duration}ms)`);
      console.log(`    ${message}`);
    }
  }

  await disconnect();

  // Summary
  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed).length;
  const total = results.length;

  console.log(`\n  ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ''}\n`);

  if (failed > 0) process.exit(1);
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
