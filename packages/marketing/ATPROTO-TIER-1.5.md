# Tier 1.5: Pantry Host on AT Protocol — Architecture Vision

## Context

Pantry Host has three tiers today:

| Tier | Package | Data lives on | Portable? |
|------|---------|---------------|-----------|
| **1: Browser PWA** | `packages/web` (5174) | PGlite → IndexedDB | No — locked to one browser |
| **2: Self-hosted** | `packages/app` (3000) | PostgreSQL on your LAN | No — locked to your server |
| **3: Agentic** | `packages/mcp` | Proxies to Tier 2's DB | Inherits Tier 2 |

Tier 1 is the most accessible (zero install, works offline) but the
least portable. Your recipes live in IndexedDB in one browser on one
device. Clear your data, switch browsers, or use a different machine
and they're gone.

AT Protocol solves this. If Pantry Host can read and write recipes
to a user's PDS instead of (or alongside) PGlite, the data travels
with the user's Bluesky identity — accessible from any device, any
browser, any app that speaks the lexicon. This is **Tier 1.5**: the
accessibility of the browser PWA, the portability of a federated
identity, and the privacy of self-hostable infrastructure.

## The Fitsky Pattern

Apps like `fitsky.app` demonstrate this working today:
1. User visits a web app (no install)
2. "Sign in with Bluesky" (app password or OAuth)
3. App reads/writes records to the user's PDS
4. Data is portable — switch apps, keep your data
5. The app itself doesn't store anything

Pantry Host can do the same with `exchange.recipe.recipe` and
`exchange.recipe.collection`. The user's recipes live on their PDS,
and Pantry Host is just a UI that renders and edits them.

## What This Changes

### Current Tier 1 architecture

```
Browser → React Router → gql() → GraphQL schema → sql`...` → PGlite (IndexedDB)
```

Every GraphQL resolver calls `sql` directly — a tagged template
wrapper around PGlite. No adapter interface, no dependency injection.
~100+ resolvers, all hardcoded to SQL.

### Proposed Tier 1.5 architecture

```
Browser → React Router → gql() → GraphQL schema → adapter → PDS (AT Protocol)
                                                  └──────→ PGlite (offline cache)
```

Two data backends, one GraphQL schema. The adapter decides where to
read/write based on auth state:
- **Signed in with Bluesky**: reads from PDS, writes to PDS, caches
  locally in PGlite for offline
- **Not signed in**: falls back to PGlite-only (current Tier 1 behavior)

### Key insight: PGlite becomes a cache, not the source of truth

When signed in, PGlite mirrors the PDS data locally for offline use.
The PDS is the source of truth. When offline, mutations queue locally
(we already have `offlineQueue` infrastructure) and sync to the PDS
when connectivity returns.

## Data Model Mapping

### Recipes

| PDS record (`exchange.recipe.recipe`) | PGlite table (`recipes`) |
|---|---|
| One record per recipe on user's PDS | One row per recipe in IndexedDB |
| Flat ingredient strings | Structured `recipe_ingredients` rows |
| AT URI as identity | UUID as primary key |
| `name`, `text`, `instructions[]` | `title`, `description`, `instructions` |

**The lossy gap**: AT Protocol recipes are flat (ingredients as
strings). PGlite recipes are structured (quantity/unit/name). This
means:
- **Write to PDS**: flatten structured → flat (lossy, intentional)
- **Read from PDS**: parse flat → structured (Claude-assisted or regex)
- **Local edits**: stored in PGlite with full structure, synced to
  PDS as flat on save

### Menus

| PDS record (`exchange.recipe.collection`) | PGlite table (`menus`) |
|---|---|
| `name`, `text`, `recipes[]` (strongRefs) | `title`, `description`, `menu_recipes[]` |
| References recipes by AT URI | References recipes by UUID |

### Ingredients (pantry)

**No AT Protocol lexicon exists for pantry inventory.** No generic
inventory or item-tracking lexicons exist in the AT Protocol
ecosystem (checked awesome-lexicons registry). The pantry is
kitchen-specific data — Pantry Host already supports multiple
kitchens, so this data should be portable.

**Approach: ship under `app.pantryhost.*`, propose to recipe.exchange
later.**

- `app.pantryhost.ingredient` — pantry item (name, category,
  quantity, unit, tags, kitchenId)
- Publish to PDS alongside recipes
- After hackathon, propose `exchange.recipe.ingredient` (or
  `exchange.pantry.ingredient`) to Josh with a working
  implementation as proof of concept. More compelling than a
  spec-only proposal.

### Cookware

Same approach as pantry — no generic equipment lexicon exists.

- `app.pantryhost.cookware` — name, brand, tags, notes
- Simple flat record, no joins needed
- Propose `exchange.recipe.cookware` to the community later

### Kitchens

- `app.pantryhost.kitchen` — name, slug
- Recipes/ingredients/cookware reference a kitchen by AT URI
- Multi-kitchen support on PDS mirrors the existing DB schema

## Auth Flow

### OAuth 2.0 / DPoP from Day 1

Use `@atproto/oauth-client-browser` — the official AT Protocol
OAuth package for SPAs. Handles DPoP, PKCE, PAR, token refresh,
and IndexedDB session storage. An official example SPA exists at
`@atproto/oauth-client-browser-example`.

```
1. User clicks "Sign in with Bluesky"
2. BrowserOAuthClient redirects to user's PDS authorization page
3. User approves, redirected back with auth code
4. Client exchanges code for DPoP-bound access token
5. Tokens stored in IndexedDB (handled by the library)
6. Set auth context → adapter switches to PDS mode
7. Fetch user's recipes from PDS → populate PGlite cache
```

**Requirements:**
- Public `client-metadata.json` URL — host on the Cloudflare Pages
  marketing site (e.g. `pantryhost.app/client-metadata.json`)
- Redirect URI registered in metadata
- Dev: ngrok or similar for local testing (localhost not valid
  for production PDS redirect URIs)

**Why not app passwords:** AT Protocol is moving away from them.
Going OAuth from the start means no migration later. The library
does the heavy lifting — DPoP key generation, nonce management,
token refresh are all handled internally.

## Architecture: The Adapter Layer

### Option A: Replace `sql` with an adapter

Refactor `packages/web/lib/db.ts` to export an adapter interface
instead of a PGlite-specific tagged template. Every resolver would
call `adapter.query()` instead of `sql\`...\``.

**Problem**: 100+ resolvers to rewrite. The `sql` tagged template
API is deeply embedded — parameterized queries, `sql.array()`,
bulk insert via `sql(rows, ...cols)`. An adapter that mimics this
API would be complex.

### Option B: Dual-mode GraphQL schema (recommended)

Keep the existing PGlite schema untouched. Add a second GraphQL
schema that reads/writes AT Protocol records. A thin routing layer
in `gql()` decides which schema to execute against based on auth
state.

```ts
// packages/web/lib/gql.ts
export async function gql<T>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const schema = isSignedIn() ? atprotoSchema : pgliteSchema;
  return graphql({ schema, source: query, variableValues: variables });
}
```

**Benefits**:
- Zero changes to existing PGlite code path
- AT Protocol schema can use `@atproto/api` directly (no SQL translation)
- Each schema optimized for its backend
- Feature parity isn't required immediately — AT Protocol schema can
  start with recipes + menus, add pantry/cookware later

**Trade-off**: two schemas to maintain. But they already diverge
(app schema has AI generation, web schema doesn't), so this is an
established pattern.

### Option C: PDS as a sync layer

Keep PGlite as the primary data store. Add a sync engine that
pushes/pulls between PGlite and the PDS in the background.

**Problem**: conflict resolution is hard. Two devices edit the same
recipe offline — which wins? PDS records are immutable snapshots
(last-write-wins via CID), but merging structured ingredient edits
requires application-level conflict resolution.

**v1 recommendation: Option B.** Clean separation, no merge
conflicts, PGlite stays as offline cache. The AT Protocol schema
is a new file, not a refactor of existing code.

## Implementation Sequence (Weekend Hackathon)

### Day 1 (Saturday)

1. **Auth context** (`packages/web/src/contexts/BlueskyAuth.tsx`)
   - `createSession` with app password
   - Store/refresh tokens
   - `useBlueskyAuth()` hook: `{ isSignedIn, handle, did, agent }`

2. **AT Protocol GraphQL schema** (`packages/web/lib/schema/atproto.ts`)
   - Recipe queries: list, get by slug/id (mapped from rkey)
   - Recipe mutations: create, update, delete (PDS writes)
   - Start with recipes only — menus on Day 2

3. **Dual-mode `gql()`** — route to AT Protocol schema when signed in

4. **"Sign in with Bluesky" UI** — button in nav or settings,
   modal with handle + app password fields

### Day 2 (Sunday)

5. **Menu/collection support** in AT Protocol schema
6. **Offline cache** — on sign-in, fetch all recipes from PDS → write
   to PGlite as cache. On mutation, write to PDS + update PGlite.
7. **Export path** — "Share to Bluesky" button on recipes/menus
   (the other half of the weekend scope from ATPROTO-SCOPE.md)
8. **Polish** — loading states, error handling, sign-out, token refresh

## What This Means for the Tiers

| Tier | Before | After |
|------|--------|-------|
| **1: Browser PWA** | PGlite only, not portable | PGlite (offline) OR PDS (signed in) |
| **1.5: Browser + Bluesky** | (new) | Sign in with Bluesky, data on PDS, works everywhere |
| **2: Self-hosted** | PostgreSQL, LAN only | + optional PDS sync (future) |
| **3: Agentic** | MCP → GraphQL → Postgres | Unchanged |

### Marketing angle

"Your recipes, everywhere. Sign in with Bluesky and your kitchen
travels with your identity — not locked to one browser, one device,
or one app."

## Open Questions for the Hackathon

1. **Ingredient structure**: AT Protocol recipes are flat strings.
   Do we parse on import (Claude/regex) or store flat and parse at
   render time? (Current import already parses — reuse that.)

2. **Recipe identity**: PGlite uses UUIDs, PDS uses rkeys. How do
   we map between them? Store `at://` URI in `sourceUrl` column?
   Or use rkey as the PGlite UUID?

3. **Deletion semantics**: user deletes a recipe in Pantry Host →
   delete the PDS record too? Or just remove from local view?
   AT Protocol deletions are real (tombstone records).

4. **Multi-device conflict**: user edits on phone (offline), edits
   on laptop (online). Laptop write lands on PDS first. Phone comes
   online — last-write-wins or prompt the user?

5. **Lexicon governance**: ship `app.pantryhost.*` for hackathon,
   propose `exchange.recipe.{ingredient,cookware}` to Josh
   afterward with working implementation as leverage?

## Dependencies

| Package | Purpose |
|---|---|
| `@atproto/api` | Record CRUD, DID resolution, Agent |
| `@atproto/oauth-client-browser` | OAuth 2.0 + DPoP for SPA auth |
| `@atproto/lexicon` | Schema validation (optional for v1) |

## Files to Create/Modify

### New files
- `packages/web/src/contexts/BlueskyAuth.tsx` — auth context + hook
- `packages/web/lib/schema/atproto.ts` — AT Protocol GraphQL schema
- `packages/web/src/components/BlueskySignIn.tsx` — sign-in modal

### Modified files
- `packages/web/lib/gql.ts` — dual-mode schema routing
- `packages/web/src/Layout.tsx` — sign-in button in nav
- `packages/web/src/main.tsx` — wrap app in auth provider
- `packages/web/src/App.tsx` — auth-aware routing

### Untouched
- `packages/web/lib/db.ts` — PGlite stays as-is
- `packages/web/lib/schema/index.ts` — existing PGlite schema unchanged
- All existing page components — they call `gql()` which transparently
  routes to the right schema
