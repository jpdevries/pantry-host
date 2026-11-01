import { describe, it } from 'node:test';
import { strict as assert } from 'node:assert';
// apiUrl.ts uses `export function`, so Node's module detection loads it as an
// ES module: named exports only, no default to destructure.
import { pickApiOrigin } from '../../packages/app/lib/apiUrl.ts';

// PUBLIC_API_ORIGIN → the API origin a page on a given hostname uses
// (packages/app/lib/apiUrl.ts). null means "fall through to the heuristics":
// same host, port 4001 for a page on :3000.
describe('pickApiOrigin (PUBLIC_API_ORIGIN, optionally scoped per hostname)', () => {
  it('applies a single unscoped origin everywhere, as before', () => {
    for (const host of ['jmini.tailb4b427.ts.net', '192.168.87.53', 'localhost']) {
      assert.equal(pickApiOrigin('http://100.125.77.118:4001', host), 'http://100.125.77.118:4001');
    }
  });

  it('applies a scoped entry only on its hostname, so LAN pages use the heuristics', () => {
    const value = 'jmini.tailb4b427.ts.net=https://jmini.tailb4b427.ts.net:4443';
    assert.equal(pickApiOrigin(value, 'jmini.tailb4b427.ts.net'), 'https://jmini.tailb4b427.ts.net:4443');
    assert.equal(pickApiOrigin(value, '192.168.87.53'), null);
  });

  it('prefers the entry scoped to the page, then the first unscoped one', () => {
    const value = ' jmini.example=https://jmini.example:4443 , http://api.example:4001, http://other:4001';
    assert.equal(pickApiOrigin(value, 'JMINI.example'), 'https://jmini.example:4443');
    assert.equal(pickApiOrigin(value, '192.168.1.20'), 'http://api.example:4001');
  });

  it('treats an empty value as unset', () => {
    assert.equal(pickApiOrigin('', 'localhost'), null);
    assert.equal(pickApiOrigin(' , ', 'localhost'), null);
  });
});
