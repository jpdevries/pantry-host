import { describe, it, before, after } from 'node:test';
import { strict as assert } from 'node:assert';
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer, type AddressInfo, type Server } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { harness } from './helpers/harness.ts';
import { gql } from './helpers/gql.ts';
import { resetDb } from './helpers/reset.ts';

// The MCP server's publish_kitchen_book tool (packages/mcp/src/tools/books.ts):
// books come back as pantry://books/ resource links and are saved for the
// home network; Send to Kindle email only when asked.
const REPO = join(import.meta.dirname, '..', '..');
const TSX_CLI = join(REPO, 'node_modules', 'tsx', 'dist', 'cli.mjs');
// The MCP server's shared imports only load under Node 20 for now (on newer
// Node, named imports from packages/shared fail at startup), so MCP_NODE can
// point at a Node 20 binary. The Mini runs MCP on Node 20.
const MCP_NODE = process.env.MCP_NODE || process.execPath;

const pandoc = spawnSync('pandoc', ['--version'], { encoding: 'utf8' });
const hasPandoc = pandoc.status === 0 && Number(/pandoc\S* (\d+)/.exec(pandoc.stdout)?.[1] ?? 0) >= 3;

interface Mail { rcpt: string[]; data: string }

/** Just enough SMTP to accept one message per connection and keep it. */
function startSmtp(): Promise<{ server: Server; port: number; mail: Mail[] }> {
  const mail: Mail[] = [];
  const server = createServer((sock) => {
    let buf = '';
    let inData = false;
    const current: Mail = { rcpt: [], data: '' };
    sock.write('220 test ESMTP\r\n');
    sock.on('data', (chunk) => {
      buf += chunk.toString('latin1');
      for (;;) {
        if (inData) {
          const end = buf.indexOf('\r\n.\r\n');
          if (end < 0) return;
          current.data = buf.slice(0, end);
          buf = buf.slice(end + 5);
          inData = false;
          mail.push({ ...current });
          sock.write('250 queued\r\n');
          continue;
        }
        const nl = buf.indexOf('\r\n');
        if (nl < 0) return;
        const line = buf.slice(0, nl);
        buf = buf.slice(nl + 2);
        const verb = line.slice(0, 4).toUpperCase();
        if (verb === 'EHLO' || verb === 'HELO') sock.write('250 test\r\n');
        else if (verb === 'RCPT') { current.rcpt.push(line); sock.write('250 ok\r\n'); }
        else if (verb === 'DATA') { inData = true; sock.write('354 go\r\n'); }
        else if (verb === 'QUIT') { sock.end('221 bye\r\n'); return; }
        else sock.write('250 ok\r\n');
      }
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ server, port: (server.address() as AddressInfo).port, mail })));
}

async function connect(env: Record<string, string>): Promise<Client> {
  const { NODE_TEST_CONTEXT: _, ...parentEnv } = process.env;
  const transport = new StdioClientTransport({
    command: MCP_NODE,
    args: [TSX_CLI, join(REPO, 'packages', 'mcp', 'src', 'index.ts')],
    env: { ...(parentEnv as Record<string, string>), GRAPHQL_URL: `${harness().url}/graphql`, ...env },
    stderr: 'ignore',
  });
  const client = new Client({ name: 'mcp-books-test', version: '1.0.0' });
  try {
    await client.connect(transport);
  } catch (e) {
    throw new Error(`The MCP server didn't start under ${MCP_NODE} (${(e as Error).message}). Set MCP_NODE to a Node 20 binary.`);
  }
  return client;
}

type Content = { type: string; text?: string; uri?: string; mimeType?: string };

describe('MCP publish_kitchen_book', { skip: hasPandoc ? false : 'pandoc 3+ not installed' }, () => {
  let booksDir: string;
  let smtp: Awaited<ReturnType<typeof startSmtp>>;
  let client: Client;

  before(async () => {
    await resetDb();
    await gql(`mutation { createKitchen(slug: "shelf", name: "Shelf") { id } }`);
    await gql(`mutation { createRecipe(title: "Oat Cookies", instructions: "Mix.\\nBake.", kitchenSlug: "shelf", tags: ["baking"],
      ingredients: [{ ingredientName: "oats", quantity: 2, unit: "cup" }]) { id } }`);
    booksDir = mkdtempSync(join(tmpdir(), 'mcp-books-'));
    smtp = await startSmtp();
    client = await connect({
      BOOKS_DIR: booksDir,
      BOOKS_URL: 'http://pantry.test:3000/books',
      SMTP_URL: `smtp://127.0.0.1:${smtp.port}`,
      SMTP_FROM: 'kitchen@pantry.test',
      KINDLE_EMAIL: 'reader@kindle.test',
    });
  });

  after(async () => {
    await client?.close();
    smtp?.server.close();
    rmSync(booksDir, { recursive: true, force: true });
  });

  it('is listed', async () => {
    const { tools } = await client.listTools();
    assert.ok(tools.some((t) => t.name === 'publish_kitchen_book'));
  });

  it('returns a resource link and a home-network download link, and sends no email', async () => {
    const res = await client.callTool({ name: 'publish_kitchen_book', arguments: { kitchens: ['shelf'], photos: 'none' } });
    assert.ok(!res.isError, JSON.stringify(res.content));
    const content = res.content as Content[];
    const { books } = JSON.parse(content[0].text!);
    assert.equal(books.length, 1);
    assert.equal(books[0].recipes, 1);
    assert.equal(books[0].downloadUrl, 'http://pantry.test:3000/books/pantry-host-shelf.epub');
    assert.equal(books[0].sentToKindle, undefined);
    assert.ok(existsSync(join(booksDir, 'pantry-host-shelf.epub')));

    const link = content.find((c) => c.type === 'resource_link');
    assert.equal(link?.uri, 'pantry://books/pantry-host-shelf.epub');
    assert.equal(link?.mimeType, 'application/epub+zip');
    assert.equal(smtp.mail.length, 0);

    // Reading the resource gives the EPUB itself: a zip whose first entry is "mimetype".
    const read = await client.readResource({ uri: link!.uri! });
    const blob = Buffer.from((read.contents[0] as { blob: string }).blob, 'base64');
    assert.equal(blob.subarray(0, 2).toString('latin1'), 'PK');
    assert.equal(blob.subarray(30, 38).toString('latin1'), 'mimetype');
    assert.equal(blob.subarray(38, 58).toString('latin1'), 'application/epub+zip');
  });

  it('lists books as resources and refuses names it did not write', async () => {
    const { resources } = await client.listResources();
    assert.ok(resources.some((r) => r.uri === 'pantry://books/pantry-host-shelf.epub'));
    await assert.rejects(client.readResource({ uri: 'pantry://books/..%2F..%2Fpantry.db' }));
  });

  it('emails Send to Kindle only when asked', async () => {
    const res = await client.callTool({ name: 'publish_kitchen_book', arguments: { kitchens: ['shelf'], photos: 'none', sendToKindle: true } });
    assert.ok(!res.isError, JSON.stringify(res.content));
    const { books } = JSON.parse((res.content as Content[])[0].text!);
    assert.equal(books[0].sentToKindle.to, 'reader@kindle.test');
    assert.equal(smtp.mail.length, 1);
    assert.match(smtp.mail[0].rcpt[0], /reader@kindle\.test/);
    assert.match(smtp.mail[0].data, /filename="?pantry-host-shelf\.epub/);
    assert.match(smtp.mail[0].data, /Content-Type: application\/epub\+zip/i);
  });

  it('explains what is missing when Send to Kindle is not set up', async () => {
    const bare = await connect({ BOOKS_DIR: booksDir, BOOKS_URL: 'http://pantry.test:3000/books', KINDLE_EMAIL: 'reader@kindle.test', SMTP_URL: '' });
    try {
      const res = await bare.callTool({ name: 'publish_kitchen_book', arguments: { kitchens: ['shelf'], photos: 'none', sendToKindle: true } });
      assert.ok(res.isError);
      assert.match((res.content as Content[])[0].text!, /SMTP_URL/);
    } finally {
      await bare.close();
    }
  });
});
