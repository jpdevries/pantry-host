# CLAUDE.md

Project context for AI agents working on this codebase.

> **Machine-specific context:** If a `CLAUDE.local.md` file exists in the repo root, read it for machine-specific setup notes (DB credentials, paths, local services, etc.). It is gitignored and varies per machine.

## What is this?

Pantry Host is a privacy-first kitchen companion for managing recipes, pantry ingredients, cookware, and grocery lists. It ships three ways: self-hosted with PostgreSQL, browser-native with PGlite, or as a static marketing page. All data stays on your hardware.

## Monorepo structure

```
pantry-host/
├── packages/
│   ├── app/          # Self-hosted Rex app (Postgres, SSR)
│   ├── shared/       # Shared types, adapters, constants, theme, components
│   ├── marketing/    # Static landing page (Vite, Cloudflare Pages)
│   ├── web/          # Browser-native PWA (PGlite + IndexedDB, Vite)
│   └── mcp/          # MCP server (Model Context Protocol for AI integrations)
├── package.json      # npm workspaces root
├── .env.local        # App env vars (DATABASE_URL, AI_PROVIDER, AI_API_KEY)
├── .claude/          # Launch configs, settings
└── CLAUDE.md
```

### npm workspaces

Root `package.json` has `"workspaces": ["packages/*"]`. Run workspace scripts via:
```bash
npm run dev                    # packages/app (Rex @ 3000)
npm run dev:graphql            # packages/app GraphQL (4001)
npm run dev:marketing          # packages/marketing (Vite @ 5173)
npm run dev:web                # packages/web (Vite @ 5174)
npm run dev:mcp                # packages/mcp (MCP server, stdio)
```

Or use `.claude/launch.json` configs: `pantry-host`, `graphql-server`, `marketing`, `web`, `mcp-server`.

## packages/app — Self-hosted (Rex + Postgres)

### Rex framework (not Next.js)

Uses **Rex** (`@limlabs/rex`), a custom React bundler built on rolldown. Mimics Next.js file-based routing but is NOT Next.js.

**Critical Rex behaviors:**
- Client bundles served from `/_rex/static/` and `/_rex/router.js`
- Stale `.rex/build` causes hydration failures. Fix: `rm -rf .rex/build` + restart
- No `<Link>` component — all `<a>` tags trigger full page loads
- Rex 0.19.2 has Tailwind v4 built into its Rust binary
- Rex's bundler doesn't follow Node module resolution up the tree. Requires React symlinks in `packages/app/node_modules/` (handled by `postinstall` script)

### Dual servers

| Server | Port | Purpose |
|--------|------|---------|
| Rex dev server | 3000 | Frontend SSR + static assets |
| GraphQL server | 4001 | API (graphql-yoga + Pothos) |
| MCP server | 5001 | AI agent integration (optional, HTTP mode) |

### Database

PostgreSQL 14+. `DATABASE_URL=postgres://jpdevries@localhost:5432/pantry_host`

Schema in `packages/app/schema.sql`, auto-applied on startup.

Tables: `kitchens`, `ingredients`, `recipes`, `recipe_ingredients`, `cookware`, `menus`, `menu_recipes`

### GraphQL schema

**`packages/app/lib/schema/index.ts` is the REAL schema.** Files `recipe.ts`, `ingredient.ts`, `cookware.ts`, `builder.ts` are dead code.

Uses the postgres.js tagged template API:
```typescript
const [row] = await sql`SELECT * FROM recipes WHERE slug = ${slug}`;
sql.array(tags)           // JS array → Postgres array
sql(rows, ...columns)     // bulk INSERT
```

### File structure

```
packages/app/
├── pages/               # Rex file-based routes
│   ├── _app.tsx         # App shell (Nav, OfflineBanner, SW, theme)
│   ├── _document.tsx    # SSR template (DEFAULT_THEME meta tag)
│   ├── index.tsx        # Dashboard
│   ├── list.tsx         # Grocery list
│   ├── ingredients.tsx  # Pantry
│   ├── cookware.tsx     # Cookware
│   ├── recipes/         # Recipe CRUD + import
│   ├── menus/           # Menu CRUD
│   └── kitchens/        # Multi-kitchen variants
├── components/          # React components
├── lib/
│   ├── gql.ts           # GraphQL HTTP client (POST to port 4001)
│   ├── db.ts            # Postgres connection (lazy-init proxy)
│   ├── schema/index.ts  # Pothos GraphQL schema
│   ├── cache.ts         # → @pantry-host/shared/cache
│   ├── claude.ts        # Anthropic SDK (AI recipes)
│   ├── apiStatus.ts     # API reachability polling
│   └── offlineQueue.ts  # Offline mutation queue
├── graphql-server.ts    # Standalone GraphQL server
├── schema.sql           # Database DDL
└── public/sw.js         # Service Worker
```

## packages/shared — Shared code

Exports used by all packages:

| Export | Description |
|--------|-------------|
| `@pantry-host/shared/constants` | Categories, units, common ingredients |
| `@pantry-host/shared/theme` | Theme management (system/light/dark, palettes, high contrast) |
| `@pantry-host/shared/cache` | localStorage cacheGet/cacheSet |
| `@pantry-host/shared/dailyQuote` | Seasonal daily quotes |
| `@pantry-host/shared/types` | TypeScript interfaces (Kitchen, Recipe, etc.) |
| `@pantry-host/shared/components/Footer` | Footer with conversions + theme controls |
| `@pantry-host/shared/adapters/database` | DatabaseAdapter interface |
| `@pantry-host/shared/adapters/file-storage` | FileStorageAdapter interface |

### Storage adapter pattern

```typescript
// DatabaseAdapter — Postgres (app) vs PGlite (web)
interface DatabaseAdapter {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  transaction<T>(fn: (adapter: DatabaseAdapter) => Promise<T>): Promise<T>;
}

// FileStorageAdapter — filesystem (app) vs OPFS (web)
interface FileStorageAdapter {
  getFile(path: string): Promise<Blob>;
  putFile(path: string, file: Blob): Promise<void>;
  deleteFile(path: string): Promise<void>;
  getURL(path: string): string;
}
```

## packages/marketing — Static landing page

Vite + React + Tailwind v4. Deploys to Cloudflare Pages via `vite build` → `dist/`.

Sections: Hero, Tiers (Browser/Self-hosted/Claude Code), Features, Philosophy, Footer.

## packages/web — Browser-native PWA

Vite + React Router + PGlite + Tailwind v4. Runs entirely in-browser — no server required.

### Key architecture

- **PGlite** (`lib/db.ts`): Postgres compiled to WASM, persisted in IndexedDB (`idb://pantryhost`). Provides a tagged template wrapper mimicking the postgres.js `sql` API so the GraphQL schema resolvers work unmodified.
- **Local GraphQL** (`lib/gql.ts`): Executes GraphQL directly in-browser via `graphql()` from `graphql-js`. Same `gql<T>(query, variables)` API as the app's HTTP client.
- **Schema** (`lib/schema/index.ts`): Copy of app's schema with AI generation removed. Uses the PGlite-backed `sql` tagged template.
- **OPFS storage** (`lib/storage-opfs.ts`): File storage in Origin Private File System.
- **Data export** (`lib/export.ts`): SQL dump for backup/migration to self-hosted.
- **No guest mode** — everything is local, user owns all features.
- **No AI generation** — no server-side API key available.

### File structure

```
packages/web/
├── src/
│   ├── main.tsx         # Entry point (theme init, PGlite init)
│   ├── App.tsx          # React Router routes
│   ├── Layout.tsx       # Nav + Footer shell
│   ├── globals.css      # Theme tokens + Tailwind v4
│   └── pages/           # Page components (Home, Recipes, Ingredients, etc.)
├── lib/
│   ├── db.ts            # PGlite tagged template wrapper
│   ├── gql.ts           # Local GraphQL executor
│   ├── schema/index.ts  # GraphQL schema (no AI)
│   ├── storage-opfs.ts  # OPFS file storage
│   ├── export.ts        # Data export
│   ├── apiStatus.ts     # Stub (always online)
│   └── offlineQueue.ts  # Stub (no remote server)
├── public/
│   ├── manifest.json    # PWA manifest
│   └── sw.js            # Service worker
├── index.html           # Vite entry
└── vite.config.ts       # Vite + React + Tailwind + @/ alias
```

## packages/mcp — MCP Server (AI integrations)

Exposes the PantryHost GraphQL API as MCP (Model Context Protocol) tools so external AI clients (Claude Desktop, IronClaw, Cursor, etc.) can interact with pantry data. Targets Tier 2 self-hosters.

### Architecture
- **Thin translation layer**: Talks to the GraphQL server over HTTP (`localhost:4001`), not directly to Postgres
- **Dual transport**: stdio (Claude Desktop) via default, HTTP on port 5001 via `--http` flag
- **Optional auth**: Set `MCP_API_KEY` env var to require `Authorization: Bearer` for HTTP transport

### Tools (29 total)
- **Read (9):** search_pantry, search_recipes, get_recipe, list_cookware, get_cookware, list_kitchens, get_kitchen, list_menus, get_menu
- **Write (15):** add_ingredient, add_ingredients, update_ingredient, remove_ingredient, create_recipe, update_recipe, delete_recipe, mark_recipe_cooked, queue_recipe, add_cookware, update_cookware, delete_cookware, create_menu, update_menu, delete_menu, toggle_recipe_in_menu
- **AI (1):** generate_recipes (requires `AI_API_KEY` on the GraphQL server)

### Resources
`pantry://ingredients`, `pantry://recipes`, `pantry://cookware`, `pantry://menus`, `pantry://kitchens`

### File structure
```
packages/mcp/
├── src/
│   ├── index.ts              # Entrypoint (stdio or HTTP transport)
│   ├── server.ts             # McpServer setup, registers tools + resources
│   ├── graphql-client.ts     # gql<T>() for talking to GraphQL on port 4001
│   ├── tools/
│   │   ├── ingredients.ts    # Pantry CRUD
│   │   ├── recipes.ts        # Recipe CRUD + queue/cook
│   │   ├── cookware.ts       # Cookware CRUD
│   │   ├── menus.ts          # Menu CRUD
│   │   ├── kitchens.ts       # Kitchen CRUD
│   │   └── generate.ts       # AI recipe generation
│   └── resources/
│       └── pantry.ts         # pantry:// read-only resources
├── package.json
└── tsconfig.json
```

### Claude Desktop setup
```json
{
  "mcpServers": {
    "pantry-host": {
      "command": "npx",
      "args": ["tsx", "/path/to/packages/mcp/src/index.ts", "--stdio"],
      "env": { "GRAPHQL_URL": "http://localhost:4001/graphql" }
    }
  }
}
```

### Dependencies
- `@modelcontextprotocol/sdk` — MCP TypeScript SDK
- `zod` — Input schema validation (required by MCP SDK)
- Requires the GraphQL server to be running on port 4001

## Conventions

### Styling
- **Tailwind CSS v4** — `@import "tailwindcss"` + `@source` directives
- CSS custom properties for theming: `--color-bg-body`, `--color-accent`, etc.
- Palettes: default, rosé, rebecca purple, claude
- Dark mode via `data-color-scheme` attribute on `<body>` + `@media (prefers-color-scheme: dark)` for system default. Managed by `@pantry-host/shared/theme`
- High contrast mode via `data-high-contrast` attribute on `<body>`

### Accessibility
- **`aria-describedby` pattern**: Action buttons use `aria-label` + `aria-describedby` pointing to the item name element (better for i18n).
- **Focus management**: Delete confirmations get `autoFocus`. Inline edit forms pass `autoFocus` to first input.
- **Scroll targets**: Category headings use `scroll-mt-20` to clear sticky navs.

### Icons
Font Awesome Pro 5.15.4 **Light** SVGs as inline React components. Source: `/Users/jpdevries/Downloads/fontawesome-pro-5.15.4-web/svgs/light/`. Copy SVG `<path>` into component, don't use an icon library.

### Theme defaulting
`DEFAULT_THEME=claude` env var → `<meta name="default-palette">` in `_document.tsx` → `getThemePalette()` reads it as fallback when no localStorage preference. Set in `.claude/launch.json`.

### GraphQL patterns
- App: `gql()` POSTs to `http://localhost:4001/graphql`
- Web: `gql()` executes GraphQL locally via `graphql-js`
- Same API signature: `gql<T>(query, variables): Promise<T>`
- Queries accept `$kitchenSlug: String` for multi-kitchen filtering

### Recipe creation
When creating or suggesting recipes (via AI generation, MCP, or conversational requests):
- Always search for and set a `photoUrl` on new recipes. Use `WebSearch` to find a relevant recipe photo, then `WebFetch` to extract the image URL from the page's structured data or hero image.
- Use the `updateRecipe` mutation to set the `photoUrl` after creation if needed.

### Recipe images
`photoUrl` supports two modes:
- **External URL** (e.g. `https://example.com/photo.jpg`) — served as-is via a plain `<img>`. Quick to set but no responsive variants, no offline caching.
- **Local upload** (e.g. `/uploads/{uuid}.jpg`) — processed by `sharp` on upload into 9 variants: 3 widths (400/800/1200) × WebP + JPEG + grayscale JPEG. Served via `<picture>` with `srcset` for responsive loading, `@media (monochrome)` for e-ink, and cached immutably by the service worker. **Preferred.**

To use local uploads: `POST /api/upload` with a `multipart/form-data` file field. The endpoint saves the original, generates variants in the background, and returns `{ url: "/uploads/{uuid}.ext" }`. Uploaded files use UUID filenames and are immutable — if an image needs replacing, upload a new file and update the recipe's `photoUrl`.

For batch processing existing uploads: `npx tsx packages/app/scripts/process-existing-uploads.ts` (idempotent).

The `ResponsiveImage` component (`components/ResponsiveImage.tsx`) handles both modes automatically — local uploads get `<picture>` with sources, external URLs get a plain `<img>` with `width`/`height` for CLS prevention.

### Composting tips
When the user asks to add composting tips to an existing recipe:
1. Query cookware for items tagged `waste-cycler` or `compost`
2. Read the cookware's `notes` field for device-specific rules (what it accepts/rejects)
3. If `notes` is empty, ask the user to provide their device's composting rules first, then save via `updateCookware`
4. Append a "Compost:" step to the recipe's instructions listing which scraps can/can't go in the device
5. Update the recipe via `updateRecipe` mutation

AI-generated recipes automatically include composting tips when composting cookware with notes is detected.

### Service Worker (`packages/app/public/sw.js`)

The SW provides offline support for the self-hosted app. Key design decisions:

**Caching strategies:**
- **Shell pages** (/, /list, /recipes, etc.) are pre-cached on install individually (not `addAll`) so one failure doesn't abort the entire install
- **Rex bundles** (`/_rex/`): network-first, cached for offline fallback
- **HTML navigation**: network-first, falls back to cache, last resort is cached homepage
- **Other same-origin** (images, fonts): stale-while-revalidate
- **Cross-origin** (GraphQL on port 4001, Google Fonts): ignored/passthrough

**Build-hash cleanup:** Rex prod builds embed an 8-char hash in filenames (e.g. `chunk-esm-557eb197.js`). Without cleanup, the cache accumulates dead entries across deploys. When a new bundle is fetched, the SW extracts the hash and purges all `/_rex/static/` entries with a different hash. No manual `CACHE_NAME` bumping needed.

**GraphQL data is NOT cached by the SW.** The SW runs on port 3000 and cannot intercept cross-origin requests to port 4001. Data caching is handled at the application level via `localStorage` (`lib/cache.ts`). Pages that depend on GraphQL (menus, recipes, grocery list) need at least one prior visit while online to populate the localStorage cache — otherwise they show skeleton UI offline.

**Testing offline:** Always test in prod mode (`rex build` + `rex start`). Dev mode uses different asset paths. On iOS, connect Safari remote debugger via Settings → Safari → Advanced → Web Inspector.

## Environment variables

```bash
DATABASE_URL=postgres://jpdevries@localhost:5432/pantry_host  # required for app
AI_PROVIDER=anthropic                                             # default: anthropic
AI_API_KEY=sk-ant-...                                             # optional, AI recipes
RECIPE_API_KEY=rapi_...                                         # optional, recipe-api.com import tab (owner-gated)
PIXABAY_API_KEY=                                                # optional, borrowed fallback images on recipe cards
PIXABAY_FALLBACK_ENABLED=true                                   # default true; feature dormant without a key
SHOW_COCKTAILDB=true                                            # default true, set false to hide TheCocktailDB import tab
GRAPHQL_PORT=4001                                               # default 4001
DEFAULT_THEME=claude                                            # auto-set by launch.json
MCP_PORT=5001                                                   # default 5001, MCP HTTP mode
MCP_API_KEY=                                                    # optional, bearer auth for MCP HTTP
GRAPHQL_URL=http://localhost:4001/graphql                       # MCP server's GraphQL target
ENABLE_IMAGE_PROCESSING=true                                    # false: skip sharp variants, save disk (Pi)
```

## Dev vs Prod mode

### Dev mode (default)
Uses local Postgres and local servers on this machine (jps-macbook-air).
```
preview_start pantry-host        # Rex dev server @ :3000
preview_start graphql-server     # GraphQL @ :4001 (local Postgres)
```

### Prod mode
Local servers connecting to Mac Mini's Postgres directly over Tailscale.
```
preview_start pantry-host           # Rex dev server @ :3000 (SSR from Mini's DB)
preview_start graphql-server-prod   # GraphQL @ :4001 (Mini's Postgres via Tailscale)
```
- Requires Tailscale connected and Mini's Postgres accepting connections
- Mini Tailscale IP: `100.125.77.118` (hostname: `jmini`)
- Mini Postgres user: `j7`, database: `pantry_host`
- Mini's `pg_hba.conf` allows Tailscale CGNAT range (`100.64.0.0/10`)
- `DATABASE_URL=postgres://j7@100.125.77.118:5432/pantry_host`

## Common tasks

### Clear stale Rex build cache
```bash
rm -rf .rex/build
```

### Install deps after monorepo changes
```bash
npm install  # from repo root, handles all workspaces
```

### Build packages
```bash
cd packages/marketing && npx vite build   # → dist/
cd packages/web && npx vite build         # → dist/
```

## Gotchas

1. **Blank pages after code changes**: Stale `.rex/build`. Delete it and restart.
2. **`react is not defined` in Rex V8**: npm workspaces hoists React to root. Rex doesn't walk up. The `postinstall` symlink script in `packages/app/package.json` fixes this.
3. **SW serving stale assets**: The SW auto-purges stale Rex bundles by build hash. If you still see issues, clear the cache: `caches.delete('pantry-host-shell').then(() => location.reload())`. Test offline behavior in prod mode only (`rex build` + `rex start`).
4. **No `<Link>` in app**: Rex uses plain `<a>` tags. The web package uses React Router `<Link>`.
5. **Tailwind v4 in Rex**: Rex 0.19.2 has Tailwind v4 built in. Don't use `@apply` — use plain CSS in `globals.css`.
6. **Guest mode (app only)**: Owner = `localhost` / `127.0.0.1` / HTTPS. Guest = HTTP on any other hostname (e.g. `http://192.168.x.x:3000`). Owners see Add, Edit, Delete, Import, inactive menus, batch scan, AI generation. Guests get read-only access to active content. The `isOwner()` function in `lib/isTrustedNetwork.ts` controls this. Not applicable to web package.
7. **PGlite WASM size**: ~2.8 MB gzipped. First load initializes schema. Subsequent loads are instant from IndexedDB.
8. **Schema sync**: `packages/web/lib/schema/index.ts` is a copy of `packages/app/lib/schema/index.ts` minus AI generation. Keep them in sync when adding queries/mutations.
9. **Rex router `query` unreliable in prod**: `useRouter().query` sometimes returns empty on dynamic routes in production builds. Always fall back to parsing `window.location.pathname` for route params (see `MenuDetailPage.tsx` for the pattern).
10. **Shared component Tailwind classes missing in app**: Rex's Tailwind v4 only scans `@source` paths. Add `@source "../../shared/src/components/";` to `globals.css` so shared component classes (grid-cols-7, flex-1, etc.) are generated.
