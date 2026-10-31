import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
import { harness } from './helpers/harness.ts';

describe('POST /fetch-recipe', () => {
  // URL passed in the request body is fetched and parsed; the mock server's
  // /recipe.html serves LD-JSON for the happy path.
  it('parses LD-JSON Recipe data from a mock page', async () => {
    const { url, mockUrl } = harness();
    const r = await fetch(`${url}/fetch-recipe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: `${mockUrl}/recipe.html` }),
    });
    assert.ok(r.ok);

    const data = (await r.json()) as {
      title: string;
      ingredients: { ingredientName: string }[];
      instructions: string;
      servings?: number;
      prepTime?: number;
      cookTime?: number;
    };
    assert.equal(data.title, 'Mock Tomato Soup');
    assert.equal(data.ingredients.length, 3);
    assert.ok(
      data.ingredients.some((i) =>
        i.ingredientName.toLowerCase().includes('tomato'),
      ),
    );
    assert.equal(data.servings, 4);
    assert.equal(data.prepTime, 5);
    assert.equal(data.cookTime, 25);
    assert.match(data.instructions, /Saute the onion/);
  });

  // /heuristic.html has only "Ingredients" / "Instructions" headings, so this
  // runs the last-resort heuristic. Its regexes once used look-ahead, which
  // panicked on first use: the debug build leaves the request hanging (hence
  // the timeout) and the release build's panic=abort kills the whole process.
  it('parses a heading-only page via the HTML heuristic', async () => {
    const { url, mockUrl } = harness();
    const r = await fetch(`${url}/fetch-recipe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: `${mockUrl}/heuristic.html` }),
      signal: AbortSignal.timeout(10_000),
    });
    assert.ok(r.ok);

    const data = (await r.json()) as {
      title: string;
      ingredients: { ingredientName: string; quantity: number | null; unit: string | null }[];
      instructions: string;
    };
    assert.equal(data.title, 'Mock Heading Pancakes');
    assert.deepEqual(
      data.ingredients.map((i) => i.ingredientName),
      ['flour', 'eggs'],
    );
    assert.equal(data.ingredients[0].unit, 'cup');
    assert.equal(data.instructions, '1. Whisk flour and eggs\n2. Fry in a hot pan');
  });

  it('returns 502 when the target URL is unreachable', async () => {
    const { url } = harness();
    const r = await fetch(`${url}/fetch-recipe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: 'http://127.0.0.1:1/nope' }),
    });
    assert.equal(r.status, 502);
  });

  it('returns 400 when the request omits the url field', async () => {
    const { url } = harness();
    const r = await fetch(`${url}/fetch-recipe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(r.status, 400);
  });
});
