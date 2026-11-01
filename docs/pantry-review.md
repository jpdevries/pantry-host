# Pantry Review — bulk update and purge

Design proposal. Status: Phase 1 in PR #67, Phase 2 in PR #68 (stacked), Phase 3 built on `feat/pantry-review-phase3` (stacked on Phase 2); Phase 4 not started.

## Problem

Every surface we have adds to the pantry (manual form, batch scan, bulk MCP
`add_ingredients`). Taking away is manual and one row at a time: edit a row's
quantity to 0, delete it, retype numbers in the app's post-cook modal, or call
`update_ingredient` with quantity 0 over MCP. Nothing is automatic or bulk:

- `completeRecipe` only sets `last_made_at`. It accepts `servings` and ignores
  it. The app's "I Made This" button follows up with a modal where the user
  retypes quantities; the web tier and the MCP `mark_recipe_cooked` tool skip
  even that. The detail-page copy already promises "update your pantry
  quantities", so the UI is writing a cheque the server doesn't cash.
- Rows have no notion of age beyond `created_at`. `updated_at` exists in the
  schema but isn't exposed over GraphQL.
- Duplicates accumulate: batch scan dedupes by barcode within one session only,
  and `add_ingredients` from an agent reading a recipe photo happily inserts
  "Garlic" next to "garlic cloves" next to "Garlic".
- Deleting is one row at a time with a per-row confirm.

Result: a Tier 3 user who imports and cooks through an agent ends up with a
pantry that is confidently wrong, which poisons the grocery list ("have") and
AI suggestions downstream.

## Goals

1. Let a person reconcile the whole pantry in one sitting: confirm, decrement,
   expire, merge, delete, in bulk, in both tiers.
2. Give agents the same power through MCP so a "clean up my pantry" request is
   one tool call to read findings and one or two to act.
3. Stop the drift at the source: cooking a recipe decrements the pantry.
4. Estimated expiry without asking the user to type dates for 200 rows.

Non-goals for v1: OCR of best-by dates, per-item freshness photos, push
notifications. Those can sit on top later.

## Data model

Three new nullable columns on `ingredients`, all TEXT ISO 8601:

| Column | Meaning |
|---|---|
| `expires_at` | Explicit best-by date. Set by the user or an agent. Wins over any estimate. |
| `stocked_at` | When this stock was last brought in. Nullable, no backfill; readers use `stocked_at ?? created_at`. Written by exactly four paths: add sets it, `updateIngredient` sets it when the new quantity exceeds the old, touch and merge set it to now. |
| (expose) `updated_at` | Already in the schema. Exposed as `updatedAt` for stale detection. |

No `estimated_expires_at` column. The estimate is derived in shared TS from
`expires_at ?? (stocked_at ?? created_at) + shelfLife(row)` so the three
resolver copies stay thin and the Rust server needs no shelf-life table.

### Why not anchor on `updated_at`

Considered and rejected. `updated_at` bumps on every write, and most writes
are not restocks: the cook decrement below touches every matched row on
every cook, and agent housekeeping (`add_pantry_alias`, retagging, attaching
barcode metadata) touches rows without new stock arriving. Anchoring there
would make the estimate most generous on the items you use most, which
inverts the goal. Skipping the bump on the decrement path, rewriting
`created_at` on restock, and writing a computed `expires_at` at stock-in were
each worse than one nullable column.

### What the barcode path contributes

Nothing on the barcode side stores a date. `barcode` is an identifier and
`product_meta` is product-level Open Food Facts or IFPS data, opt-in and only
on scanned rows. OFF's own `expiration_date` is whatever was printed on the
pack a contributor photographed, so it is not fetched. What `product_meta`
does offer is a sharper shelf-life input: `categories_tags` and
`pnns_groups_2` distinguish "en:uht-milks" from "en:fresh-milks" and
"en:canned-tomatoes" from "en:fresh-tomatoes". `shelfLife(row)` checks those
first and falls back to the pantry category.

### Migration mechanism (new)

The SQLite schema is `CREATE TABLE IF NOT EXISTS` only. Every column we have
today shipped in the initial SQLite commit, so there is no path for adding one
to an existing database. `ALTER TABLE … ADD COLUMN` isn't idempotent in SQLite,
so each runtime needs a guard:

- `packages/shared/src/sql/migrations.json`: a list of
  `{ table, column, ddl }` entries.
- `packages/app/lib/db.ts`, `packages/web/lib/db.ts`: after `SCHEMA_SQL`,
  read `pragma_table_info(table)` and run each `ddl` whose column is missing.
- `packages/server/src/db.rs`: `include_str!` the same JSON and do the same.

No backfill: `stocked_at` stays null on existing rows and readers fall back
to `created_at`.

## Shared logic: `@pantry-host/shared/pantry-review`

Pure functions, unit-tested, no I/O. Used by both UIs and by the MCP server.

### Shelf-life table

Per category, in days, with a `frozen` tag override and an OFF category-tag
refinement for scanned rows (see above). Rough first cut by pantry category:

| Category | Days | | Category | Days |
|---|---|---|---|---|
| seafood & fish | 2 | | plant-based milks | 10 |
| meat & poultry | 3 | | tofu & tempeh | 7 |
| fresh herbs | 5 | | eggs | 28 |
| deli & charcuterie | 5 | | snacks | 90 |
| vegetables | 7 | | nuts & seeds | 180 |
| fruit | 7 | | condiments & sauces | 180 |
| dairy | 14 | | beverages | 365 |
| frozen (category or tag) | 180 | | oils & vinegars | 365 |
| dry goods & grains | 365 | | herbs & spices | 365 |
| legumes & pulses | 365 | | baking | 365 |
| canned & jarred | 730 | | other | none |

`alwaysOnHand` rows are exempt from every signal below.

### `reviewPantry(ingredients, now)` → findings

| Signal | Rule | Suggested action |
|---|---|---|
| `expired` | `estimatedExpiresAt < now` | Toss, or "still good" (bumps `stocked_at`) |
| `expiring` | within 3 days | Use it: link to recipes that need it |
| `stale` | no stated date and no shelf-life basis (category `other` or unknown), and `stockedAt ?? createdAt` older than 180 days. Rows with a basis are covered by `expired` once past it, so a multiplier on shelf life would never fire. | "Still have it?" yes / used up / toss |
| `duplicate` | same `normalizeIngredientName`, alias overlap, or same barcode (reuse `pantryIndex` from `grocery-status`) | Merge |
| `outOfStock` | `quantity = 0` for more than 14 days | Delete, or restock |

Each finding carries the row ids, the signal, a one-line reason, and the
estimate's provenance (`explicit` vs `estimated`) so the UI can label it
honestly.

### `planMerge(survivor, others)`

Quantities sum when `unitsComparable`, else the survivor's quantity is kept and
the UI says so. Tags and aliases union. The merged rows' names become aliases
of the survivor, so recipe matching gets better as a side effect. Barcode and
`productMeta` come from the survivor, else the first non-null. `stocked_at`
becomes the newest. Matches the existing meaning of "normalize": merge
quantities and tags into the survivor, then delete the duplicates.

## GraphQL

Implemented three times as usual: `packages/app/lib/schema`,
`packages/web/lib/schema`, `packages/server/src/graphql/ingredient.rs`.

Fields: `Ingredient.expiresAt`, `Ingredient.stockedAt`, `Ingredient.updatedAt`.
`addIngredient`, `addIngredients`, `updateIngredient` accept `expiresAt`.
`updateIngredient` sets `stocked_at` when the new quantity exceeds the old
(a CASE expression in each of the three resolvers; no shelf-life logic).

New mutations, each a single transaction:

```graphql
updateIngredients(inputs: [IngredientPatchInput!]!): [Ingredient!]!   # id + any updateIngredient arg; omitted = keep, expiresAt: null clears
deleteIngredients(ids: [String!]!): Int!
mergeIngredients(survivorId: String!, mergeIds: [String!]!): MergeIngredientsResult!   # { ingredient, mergedIds, unmergedQuantities }
touchIngredients(ids: [String!]!): [Ingredient!]!                     # "still have it": stocked_at = updated_at = now
```

`updateIngredient` and `IngredientInput` gain `expiresAt`. On
`updateIngredient`, omitting `expiresAt` keeps the date and passing `null`
clears it (Pothos sees the difference; the Rust side uses
`MaybeUndefined`). `updateIngredients` keeps every omitted field, unlike
`updateIngredient`, which still replaces quantity and unit as the edit form
expects, so a bulk date-only patch can't wipe quantities.

Cooking is a new mutation rather than a change to `completeRecipe`, so the
existing clients keep working until Phase 3 moves them over:

```graphql
cookRecipe(id: String!, servings: Int, decrementPantry: Boolean = true, dryRun: Boolean = false): CookRecipeResult!
# CookRecipeResult { recipe, applied, pantryChanges: [{ recipeIngredient, ingredientId, pantryName, before, after, unit, status }] }
```

For each recipe line, resolve the pantry row with the grocery list's
matching tiers (`findPantryItem`), scale by `servings / recipe.servings`,
convert units with `convert` through the two-dimension total model, subtract,
clamp at 0. `status` says what happened: `decremented`, `unmatched`,
`always_on_hand`, `untracked`, `no_quantity`, `unconvertible`. Only
`decremented` rows are written, and the write bumps `updated_at` but not
`stocked_at`. `dryRun` returns the same plan without writing, so the UI can
preview and an agent can show the user. `completeRecipe` stays as the
lastMadeAt-only mutation. The planner is `@pantry-host/shared/pantry-decrement`
(pure, used by both TS resolvers) with a Rust port in
`packages/server/src/pantry_decrement.rs` plus `units.rs`.

## UI (Tier 1 web and Tier 2 app, at parity)

### Review page

New route `/kitchens/:kitchen/ingredients/review` (edge-shortened to
`/ingredients/review` for home). Owner-only in the app. Separate page rather
than a mode on the pantry list, so the pantry page stays a reading page and
the review page can be `data-requires-js` throughout.

Layout: one `<fieldset>` per signal, in the order expired, expiring, stale,
duplicates, out of stock. Each row is a checkbox labelled by name, quantity,
and reason ("estimated from dairy, stocked 19 days ago"). Each fieldset has a
"select all" checkbox. One sticky action bar at the bottom holds the bulk
actions for the current selection: Still have it, Used up (quantity 0), Set
expiry date, Delete. Duplicate groups get a Merge button on the group with a
radio for the survivor.

Tab stops: one per row plus the action bar, not four per row. A 60-row review
is about 70 stops, not 240.

Confirm only for Delete and Merge. A pre-mounted empty `role="status"` region
announces results ("Removed 4 items"). Undo for the last bulk action, held in
component state until the next action.

### Elsewhere

- Pantry list rows: a small badge for expired or expiring soon, from the same
  shared function. "Needs review (N)" link next to Batch Scan when findings
  exist.
- Dashboard: a "Needs review" stat card beside Ingredients.
- `IngredientForm`: optional Best-by date input, with a hint showing the
  estimate the review would otherwise make. Batch scan rows are not prefilled:
  a prefilled estimate would be saved as a stated date.
- Recipe detail, both tiers: "I Made This" calls `cookRecipe(dryRun: true)`,
  shows the planned changes with per-line checkboxes, then commits. Replaces
  the retype-the-numbers modal in the app and adds the flow to the web tier.

## MCP

Six new or changed tools, plus a resource:

| Tool | Notes |
|---|---|
| `review_pantry` | Read. Runs `reviewPantry` on `search_pantry` output. Args: `kitchenSlug`, `signals` filter, `staleDays` override. Returns findings grouped by signal with ids and reasons, so an agent can propose a cleanup in one turn. |
| `update_ingredients` | Bulk patch via `updateIngredients`. |
| `remove_ingredients` | Bulk delete. Tool text steers agents to `update_ingredients` with quantity 0 unless the user said to delete. |
| `merge_ingredients` | `mergeIngredients`, with the plan echoed back. |
| `touch_ingredients` | "Still have it" for a list of ids. |
| `mark_recipe_cooked` | Gains `servings`, `decrementPantry` (default true), `dryRun`. Returns the pantry changes so the agent can tell the user. |

`search_pantry` and `pantry://ingredients` include `expiresAt`, `stockedAt`,
`updatedAt`. New resource `pantry://review` returns the current findings.

## Phases

Each phase is a mergeable PR with tests. Phase 1 is the only one with a
schema change, so it ships first and alone.

1. **Foundation.** Done. Migration mechanism in three runtimes
   (`shared/sql/migrations.json` + `migrations.ts`, guards in app `db.ts`, web
   `db.worker.ts`, Rust `db.rs`), two columns, GraphQL fields, bulk mutations,
   `cookRecipe` with `dryRun`. Integration tests in
   `tests/integration/ingredients.test.ts`, `recipe-lifecycle.test.ts` and
   `migrations.test.ts` run against the Rust server; the Node resolvers were
   checked with the same mutation script by hand, and the Rust planner and
   migration guard have unit tests.
2. **Shared review logic.** Done. `@pantry-host/shared/pantry-review`:
   `shelfLife` (OFF tags → `frozen` tag → category table), `estimatedExpiry`
   with provenance, `reviewPantry` with options (`expiringWithinDays`,
   `staleDays`, `outOfStockDays`, `signals`), `findDuplicates` (union-find over
   normalized name, alias and barcode), `pickSurvivor`, `planMerge`. 25 unit
   tests (`npm test` in `packages/shared`): the garlic triplet, an expired
   yogurt, a restocked jar that must not flag, a frozen steak, UHT milk from a
   barcode, always-on-hand salt. One freshness signal per row by priority
   (out of stock, expired, expiring, stale); duplicates overlap freely.
3. **UI.** Done, both tiers. `/ingredients/review` (shared
   `components/PantryReview`, wrapped per tier), review badges and a
   "Review (N)" link on the pantry list, a "Needs review" dashboard card,
   a Best-by field in `IngredientForm` whose hint shows the estimate the
   review would make, and `components/CookPreviewModal` replacing the
   retype-the-numbers modal: `cookRecipe(dryRun)` → checkboxes → only
   confirmed rows are written (`applyCookPlan`). Verified in the browser on
   :3000 and :5174, including merge, bulk delete, partial cook, and the
   dialog's focus trap / `aria-hidden` / focus return (the last was a
   shared-Modal bug, fixed there). Scope notes: Undo covers "Used up" only
   (delete and merge confirm instead; touch has no previous state to
   restore). Batch scan does **not** prefill Best-by from the estimate:
   that would turn estimates into stated dates. The first review of an old
   pantry is a wall of "expired" rows stocked months ago; "Select all" +
   "Still have it" is the designed one-click way through it. Every date the
   UI shows is a `<time datetime>` element via the shared `RelativeTime`
   component (relative phrase as text, absolute date as tooltip, no
   `Intl`); findings carry `basis` and `since` so the page composes from
   fields while `reason` stays plain text for MCP. The production build's
   Kindle checks (legacy twins, forbidden syntax, missing APIs, lite.css)
   pass with the new pages included. Tab fatigue: the action bar is first
   in DOM order and sticky at the top, and the same actions repeat as a
   static bar after the last group for anyone who reads to the end; with
   nothing selected the action buttons are disabled, so a keyboard user
   meets one live Select-all button before the rows. Single-key shortcuts
   (A select all/none, I mark in stock, O mark out of stock, B set best-by
   date, D delete, Esc clear) are bound on the review's root so they only fire while focus
   is inside it (WCAG 2.1.4), exposed with `aria-keyshortcuts` and visible
   `<kbd>` hints plus a one-line legend. The bar's CTAs are Select all,
   Mark in stock, Mark out of stock, Set best-by date and Delete; Merge
   stays on each duplicate group. Closing a confirmation or the date field
   returns focus to its button. **What Delete means:** Mark out of stock
   is the metadata-preserving delete (quantity 0; tags, aliases, barcode
   data and history survive; the stated best-by is cleared because it
   belonged to the carton just finished, and restocking restarts the
   estimate). Delete drops the row. The Delete confirmation says what is
   lost and offers "Mark out of stock instead" as its first, focused
   button; the Out of stock group (zero for 14+ days, never restocked) is
   where hard delete belongs.
4. **MCP.** The tools above, `pantry://review`, updated tool descriptions.
   Tool count moves from 34 to 39.

## Open questions

- Decrement on "I Made This": default on with a preview, or opt-in? Proposal:
  on with preview, since the copy already promises it and the preview makes it
  safe.
- Stale thresholds: 2× shelf life is a guess. Make `staleDays` a setting in
  `SETTINGS_SCHEMA` or leave it to the MCP arg only?
- Should `review_pantry` also propose recipes for expiring items (a second
  query against `recipes`), or leave that composition to the agent?
