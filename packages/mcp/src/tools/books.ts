import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import nodemailer from 'nodemailer';
import { ResourceTemplate, type McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { checkBookTools, publishKitchenBook, type BookResult } from '@pantry-host/shared/publish-book';

/**
 * Kitchens as EPUB cookbooks over MCP (see @pantry-host/shared/publish-book).
 *
 * Every book is delivered two ways:
 * 1. as a `pantry://books/<file>` resource the client can read, and
 * 2. saved in the app's public/books/, so Rex serves it on the home network.
 * A third way, Send to Kindle email, runs only when the caller asks for it,
 * because it puts the book on Amazon's servers.
 */

const APP_DIR = fileURLToPath(new URL('../../../app/', import.meta.url));
const BOOKS_DIR = process.env.BOOKS_DIR ?? join(APP_DIR, 'public', 'books');
const BOOK_FILE = /^pantry-host-[a-z0-9-]+\.epub$/;
const EPUB = 'application/epub+zip';
// Send to Kindle's limit for email attachments.
const KINDLE_MAX_BYTES = 50 * 1024 * 1024;

/**
 * Where devices on the home network download books from. BOOKS_URL wins;
 * otherwise the address start-rex.sh writes to public/network-info.json, then
 * this machine's first LAN IPv4, on APP_URL's port (Rex, default 3000).
 */
function booksBaseUrl(): string {
  if (process.env.BOOKS_URL) return process.env.BOOKS_URL.replace(/\/+$/, '');
  const app = new URL(process.env.APP_URL ?? 'http://localhost:3000');
  let host: string | undefined;
  try {
    const info = JSON.parse(readFileSync(join(APP_DIR, 'public', 'network-info.json'), 'utf8')) as { ip?: string };
    host = info.ip;
  } catch {
    // No network-info.json; fall back to the interfaces.
  }
  host ??= Object.values(networkInterfaces()).flat().find((i) => i && i.family === 'IPv4' && !i.internal)?.address;
  return `${app.protocol}//${host ?? app.hostname}:${app.port || (app.protocol === 'https:' ? 443 : 80)}/books`;
}

async function sendToKindle(book: BookResult, to: string): Promise<string> {
  const smtp = process.env.SMTP_URL;
  if (!smtp) {
    throw new Error('Send to Kindle needs SMTP_URL on the MCP server (e.g. smtps://you%40gmail.com:app-password@smtp.gmail.com:465). The sending address must be on your Amazon approved sender list.');
  }
  if (book.bytes > KINDLE_MAX_BYTES) {
    throw new Error(`${book.name} is ${(book.bytes / 1048576).toFixed(1)} MB; Send to Kindle takes up to 50 MB by email. Try photos "gray" or "none".`);
  }
  const transport = nodemailer.createTransport(smtp);
  const from = process.env.SMTP_FROM ?? decodeURIComponent(new URL(smtp).username);
  const info = await transport.sendMail({
    from,
    to,
    subject: book.name,
    text: `${book.name}: ${book.recipes} recipes from Pantry Host.`,
    attachments: [{ filename: book.file.split('/').pop(), path: book.file, contentType: EPUB }],
  });
  return info.messageId;
}

export function registerBookTools(server: McpServer) {
  server.resource(
    'kitchen-books',
    new ResourceTemplate('pantry://books/{file}', {
      list: async () => ({
        resources: (existsSync(BOOKS_DIR) ? readdirSync(BOOKS_DIR) : [])
          .filter((f) => BOOK_FILE.test(f))
          .map((f) => ({ uri: `pantry://books/${f}`, name: f, mimeType: EPUB })),
      }),
    }),
    { description: 'Kitchen cookbooks built by publish_kitchen_book (EPUB)', mimeType: EPUB },
    async (uri, { file }) => {
      const name = Array.isArray(file) ? file[0] : file;
      // Only file names this tool writes, so the URI can't reach outside BOOKS_DIR.
      if (!BOOK_FILE.test(name) || !existsSync(join(BOOKS_DIR, name))) throw new Error(`No book named ${name}`);
      return { contents: [{ uri: uri.href, mimeType: EPUB, blob: readFileSync(join(BOOKS_DIR, name)).toString('base64') }] };
    },
  );

  server.tool(
    'publish_kitchen_book',
    `Build kitchens into EPUB cookbooks (photo cover, active menus by course, recipes A–Z, index by tag) on this server. Each book comes back as a pantry://books/<file> resource link and is saved where the self-hosted app serves it, with a download link that works on the home network. That's the default, and it keeps the book on the user's hardware.

Only set sendToKindle when the user explicitly asks to email the book to their Kindle. It sends the book through the server's SMTP account (SMTP_URL) to KINDLE_EMAIL or kindleEmail, which puts it on Amazon's servers. Needs pandoc 3+ and ImageMagick on the server.`,
    {
      kitchens: z.array(z.string()).min(1).describe('Kitchen slugs, e.g. ["home"]. Use list_kitchens to see them.'),
      photos: z.enum(['color', 'gray', 'none']).default('color').describe('color for color e-readers, tablets and phones; gray for black-and-white e-ink (smaller); none for a text-only book.'),
      sendToKindle: z.boolean().default(false).describe('Also email each book to Send to Kindle. Only when the user asks for it.'),
      kindleEmail: z.string().email().optional().describe('Send to Kindle address; defaults to KINDLE_EMAIL on the server.'),
    },
    async ({ kitchens, photos, sendToKindle: kindle, kindleEmail }) => {
      checkBookTools(photos);
      const to = kindleEmail ?? process.env.KINDLE_EMAIL;
      if (kindle && !to) throw new Error('No Send to Kindle address: pass kindleEmail or set KINDLE_EMAIL on the MCP server.');

      const base = booksBaseUrl();
      const books = [];
      const links = [];
      for (const slug of [...new Set(kitchens)]) {
        const book = await publishKitchenBook(slug, {
          graphqlUrl: process.env.GRAPHQL_URL ?? 'http://localhost:4001/graphql',
          appUrl: process.env.APP_URL ?? 'http://localhost:3000',
          photos,
          outDir: BOOKS_DIR,
        });
        const file = book.file.split('/').pop()!;
        const kindleResult = kindle ? { to, messageId: await sendToKindle(book, to!) } : undefined;
        books.push({
          kitchen: book.kitchen,
          title: book.name,
          recipes: book.recipes,
          menus: book.menus,
          photos: book.photos,
          bytes: statSync(book.file).size,
          resource: `pantry://books/${file}`,
          downloadUrl: `${base}/${file}`,
          missingPhotos: book.missingPhotos,
          ...(kindleResult ? { sentToKindle: kindleResult } : {}),
        });
        links.push({
          type: 'resource_link' as const,
          uri: `pantry://books/${file}`,
          name: file,
          title: `${book.name} (EPUB)`,
          description: `${book.recipes} recipes, ${book.photos} photos`,
          mimeType: EPUB,
        });
      }
      return { content: [{ type: 'text' as const, text: JSON.stringify({ books }, null, 2) }, ...links] };
    },
  );
}
