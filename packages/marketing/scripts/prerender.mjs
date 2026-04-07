// Static prerender of marketing routes.
// Reads the client-built index.html template, runs the SSR bundle's render(url)
// for each route, injects the HTML into <div id="root"><!--app-html--></div>,
// and writes dist/<route>/index.html.
import { readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const distDir = resolve(root, 'dist');
const serverDir = resolve(root, 'dist-ssr');

const ROUTES = ['/', '/accessibility'];

const template = await readFile(resolve(distDir, 'index.html'), 'utf8');
const { render } = await import(pathToFileURL(resolve(serverDir, 'entry-server.js')).href);

for (const url of ROUTES) {
  const appHtml = render(url);
  const html = template.replace('<!--app-html-->', appHtml);
  const outPath = url === '/'
    ? resolve(distDir, 'index.html')
    : resolve(distDir, url.replace(/^\//, ''), 'index.html');
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, html, 'utf8');
  console.log(`prerendered ${url} → ${outPath.replace(root + '/', '')}`);
}

// Clean up the SSR bundle — Cloudflare Pages doesn't need it.
await rm(serverDir, { recursive: true, force: true });
