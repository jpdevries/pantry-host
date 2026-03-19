# CLAUDE.md

Project context for AI agents working on this codebase.

## What is this?

Pantry Host is a self-hosted, privacy-first PWA for managing a home kitchen — recipes, pantry ingredients, cookware, and grocery lists. Runs on a local machine (Mac Mini) with PostgreSQL. All data stays on the home network.

## Architecture

### Rex framework (not Next.js)

This project uses **Rex** (`@limlabs/rex`), a custom React bundler built on rolldown. It mimics the Next.js file-based routing API (`pages/`, `useRouter`, `next/head`) but is NOT Next.js.

**Critical Rex behaviors:**
- Client bundles are served from `/_rex/static/` and `/_rex/router.js`
- Bundles are hash-named (e.g., `recipes-_slug_-4f24bdbc.js`)
- After code changes, stale `.rex/build` can cause hydration failures or blank pages. Fix: `rm -rf .rex/build` + restart dev server
- There is no `<Link>` component — all navigation uses plain `<a>` tags (full page navigations, not SPA)

### Dual servers

| Server | Port | Purpose |
|--------|------|---------|
| Rex dev server | 3000 | Frontend SSR + static assets |
| GraphQL server | 4001 | API (graphql-yoga + Pothos) |

Start both via `.claude/launch.json` configs or manually:
```bash
# Terminal 1 — frontend
source .env.local && npx @limlabs/rex dev --host 0.0.0.0

# Terminal 2 — API
source .env.local && npx tsx graphql-server.ts
```

### Database

PostgreSQL 14+. Connection: `DATABASE_URL=postgres://jpdevries@localhost:5432/pantry_host`

Schema is in `schema.sql` and auto-applied on startup. No migration tool — just edit the file.

Tables: `kitchens`, `ingredients`, `recipes`, `cookware`, `recipe_ingredients`

### GraphQL schema

**`lib/schema/index.ts` is the REAL schema** used by `graphql-server.ts`. The files `lib/schema/recipe.ts`, `ingredient.ts`, `cookware.ts`, `builder.ts` exist but are NOT imported — they are dead code from an earlier refactor.

## File structure

```
pages/                     # Rex file-based routes
  _app.tsx                 # App shell (Nav, OfflineBanner, SW registration)
  index.tsx                # Homepage dashboard with stat cards
  list.tsx                 # Grocery list (queued recipes)
  ingredients.tsx          # Pantry management
  cookware.tsx             # Cookware inventory
  recipes/
    index.tsx              # Recipe list with search
    [slug].tsx             # Recipe detail (takes slug OR uuid)
    [slug]/edit.tsx         # Edit recipe
    new.tsx                # Create recipe
    import.tsx             # Import from URL
  kitchens/                # Multi-kitchen variants of above
  api/
    graphql.ts             # GraphQL endpoint (Next.js-style handler)
    upload.ts              # Photo upload
    fetch-recipe.ts        # Fetch recipe metadata from URL
    lookup-barcode.ts      # Open Food Facts barcode lookup

components/
  Nav.tsx                  # Left sidebar navigation
  OfflineBanner.tsx        # Offline status indicator
  RecipeForm.tsx           # Shared create/edit recipe form
  IngredientForm.tsx       # Ingredient form (has autoFocus prop)
  RecipeCard.tsx           # Recipe preview card
  GenerateButton.tsx       # AI recipe generation (owner-only)
  BarcodeScanner.tsx       # Camera barcode scanner
  BatchScanSession.tsx     # Batch scanning workflow
  pages/                   # Page-level components
    RecipeDetailPage.tsx
    RecipesIndexPage.tsx
    IngredientsPage.tsx
    GroceryListPage.tsx
    CookwarePage.tsx
    CookwareDetailPage.tsx
    RecipeNewPage.tsx
    RecipeEditPage.tsx
    RecipeImportPage.tsx

lib/
  gql.ts                   # GraphQL fetch client (POST to port 4001)
  cache.ts                 # localStorage cache (cacheGet/cacheSet)
  offlineQueue.ts          # Mutation queue for offline support
  apiStatus.ts             # API reachability polling (port 4001)
  db.ts                    # PostgreSQL connection (lazy-init proxy)
  claude.ts                # Anthropic SDK integration
  constants.ts             # Categories, units, common items
  schema/index.ts          # THE schema (Pothos GraphQL builder)

graphql-server.ts          # Standalone GraphQL server entry point
schema.sql                 # Database DDL
public/sw.js               # Service Worker (PWA caching)
```

## Conventions

### Styling
- **Tailwind CSS** with dark mode via `prefers-color-scheme` media query
- Accent color: amber (`text-amber-600`, `dark:text-amber-400`)
- Card pattern: `className="card"` (defined in globals.css)
- Frosted glass: `bg-white/90 dark:bg-zinc-950/90 backdrop-blur`

### Accessibility
- **`aria-describedby` pattern**: Action buttons (Edit, Delete, Yes, No) use simple `aria-label` + `aria-describedby` pointing to the item's name element. This is preferred over interpolated labels (e.g., "Delete Cinnamon") because it produces fewer strings to translate for localization.
  ```tsx
  <span id={`ing-${ing.id}`}>{ing.name}</span>
  <button aria-label="Edit" aria-describedby={`ing-${ing.id}`}>
  <button aria-label="Delete" aria-describedby={`ing-${ing.id}`}>
  ```
- **Focus management**: Delete confirmation buttons get `autoFocus`. Inline edit forms pass `autoFocus` to the first input.
- **Scroll targets**: Category headings use `scroll-mt-20` to clear sticky navs.

### Icons
Font Awesome Pro 5.15.4 **Light** SVGs, used as inline React components. Source files at `/Users/jpdevries/Downloads/fontawesome-pro-5.15.4-web/svgs/light/`. Do NOT use an icon library — copy the SVG `<path>` into a component:
```tsx
const iconProps = { xmlns: 'http://www.w3.org/2000/svg', width: 20, height: 20, fill: 'currentColor', 'aria-hidden': true as const };
function CarrotIcon() { return <svg viewBox="0 0 512 512" {...iconProps}><path d="M298.2 ... "/></svg>; }
```

### Offline & caching
- **Cache-seeded initial state**: Components read from `cacheGet()` in `useState` initializer for instant rendering, then fetch fresh data and `cacheSet()` on success.
- **Skeleton UI**: Show pulsing placeholder blocks while loading on first visit (no cache).
- **Offline queue**: Failed mutations are stored in localStorage via `enqueue()` and replayed when API comes back online.

### Service Worker (`public/sw.js`)
- Network-first for `/_rex/` paths and navigation requests
- Stale-while-revalidate for images, fonts, etc.
- Cache version must be bumped when changing SW logic (currently `v4`)
- Navigation fallback chain: network -> cached page -> cached `/` (home shell)

### GraphQL patterns
- Client-side: use `gql()` from `lib/gql.ts` which POSTs to `http://localhost:4001/graphql`
- Queries accept `$kitchenSlug: String` for multi-kitchen filtering
- Recipe detail accepts `$id: String!` which resolves by slug first, then UUID fallback

## Environment variables

```bash
DATABASE_URL=postgres://jpdevries@localhost:5432/pantry_host  # required
ANTHROPIC_API_KEY=sk-ant-...                                    # optional, for AI recipes
GRAPHQL_PORT=4001                                               # default 4001
```

## Common tasks

### Clear stale build cache
```bash
rm -rf .rex/build
```

### Query the database directly
```bash
psql pantry_host -c "SELECT title, queued FROM recipes;"
```

### Test GraphQL API
```bash
curl -s -X POST http://localhost:4001/graphql \
  -H 'Content-Type: application/json' \
  -d '{"query":"{ recipes { id slug title } }"}'
```

## Gotchas

1. **Blank pages after code changes**: Almost always stale `.rex/build`. Delete it and restart.
2. **SW serving stale assets**: Bump `CACHE_NAME` version in `public/sw.js`. Users need a hard refresh or tab close/reopen for the new SW to activate.
3. **Schema duplication**: `lib/schema/index.ts` is the only schema file that matters. The others (`recipe.ts`, `ingredient.ts`, etc.) are dead code.
4. **No `<Link>` component**: All `<a>` tags trigger full page loads. This is by design with Rex.
5. **Guest mode**: Non-localhost HTTP access hides owner-only features (AI generation, barcode scanner, cookware). Checked via `window.location.hostname` and `protocol`.
6. **iOS camera requires HTTPS**: Barcode scanning needs `mkcert` + `local-ssl-proxy` for mobile testing. See `scripts/https-proxy.sh`.
