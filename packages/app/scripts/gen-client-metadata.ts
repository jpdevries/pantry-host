/**
 * Generate a `client-metadata.json` for a self-hosted Pantry Host instance
 * that wants OAuth *sovereignty* — completing Bluesky sign-in against its own
 * origin instead of routing through the pantryhost.app publish broker.
 *
 * AT Protocol OAuth identifies a client by a public HTTPS document whose URL
 * IS the `client_id`. To publish from `https://recipes.example.com`, host the
 * generated JSON at `https://recipes.example.com/client-metadata.json` and set
 * `ATPROTO_CLIENT_ID=https://recipes.example.com/client-metadata.json` in the
 * app's environment. See docs/self-hosted-oauth.md for the full walkthrough.
 *
 * Usage:
 *   npx tsx packages/app/scripts/gen-client-metadata.ts https://recipes.example.com
 *   npx tsx packages/app/scripts/gen-client-metadata.ts https://recipes.example.com --name "My Kitchen"
 *   npx tsx packages/app/scripts/gen-client-metadata.ts https://recipes.example.com -o packages/app/public/client-metadata.json
 *
 * With no -o/--out, the document is printed to stdout.
 */

import { promises as fs } from 'fs';
import { buildClientMetadata } from '@pantry-host/shared/atproto-client';

function parseArgs(argv: string[]): {
  baseUrl?: string;
  name?: string;
  out?: string;
} {
  const out: { baseUrl?: string; name?: string; out?: string } = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--name') {
      out.name = argv[++i];
    } else if (arg === '-o' || arg === '--out') {
      out.out = argv[++i];
    } else if (!arg.startsWith('-') && !out.baseUrl) {
      out.baseUrl = arg;
    }
  }
  return out;
}

async function main() {
  const { baseUrl, name, out } = parseArgs(process.argv.slice(2));

  if (!baseUrl) {
    console.error(
      'Usage: npx tsx packages/app/scripts/gen-client-metadata.ts <https-base-url> [--name "Display Name"] [-o out.json]\n' +
        '\n' +
        'Example:\n' +
        '  npx tsx packages/app/scripts/gen-client-metadata.ts https://recipes.example.com',
    );
    process.exit(1);
  }

  let metadata;
  try {
    metadata = name ? buildClientMetadata(baseUrl, name) : buildClientMetadata(baseUrl);
  } catch (err) {
    console.error(`✗ ${(err as Error).message}`);
    process.exit(1);
    return;
  }

  const json = JSON.stringify(metadata, null, 2) + '\n';

  if (out) {
    await fs.writeFile(out, json, 'utf8');
    console.error(`✓ Wrote ${out}`);
    console.error(`  Host it at:   ${metadata.client_id}`);
    console.error(`  Then set:     ATPROTO_CLIENT_ID=${metadata.client_id}`);
    console.error(`  Callback URI: ${metadata.redirect_uris[0]}`);
  } else {
    process.stdout.write(json);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
