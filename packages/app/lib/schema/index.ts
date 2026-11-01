import SchemaBuilder from '@pothos/core';
import { join } from 'path';
import { randomUUID } from 'node:crypto';
import sql, { bulkInsert } from '@/lib/db';
import { planPantryDecrement, type PantryChange } from '@pantry-host/shared/pantry-decrement';
import { convert, normalizeUnit } from '@pantry-host/shared/units';
import { generateRecipes as aiGenerateRecipes } from '@/lib/claude';
import { copyFriendlyPhoto } from '@/lib/image-server';

const builder = new SchemaBuilder({});

builder.queryType({});
builder.mutationType({});

// SQLite row helpers ─────────────────────────────────────────────────────────

function parseJsonArr(v: unknown): string[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v as string[];
  if (typeof v !== 'string') return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function nowIso(): string {
  return new Date().toISOString();
}

/** Run `fn` inside one SQLite transaction; rolls back on throw. */
async function withTransaction<T>(fn: () => Promise<T>): Promise<T> {
  await sql`BEGIN`;
  try {
    const result = await fn();
    await sql`COMMIT`;
    return result;
  } catch (err) {
    try { await sql`ROLLBACK`; } catch { /* already rolled back */ }
    throw err;
  }
}

// ── Kitchen ───────────────────────────────────────────────────────────────────

const KitchenType = builder.objectType('Kitchen', {
  fields: (t) => ({
    id: t.exposeString('id'),
    slug: t.exposeString('slug'),
    name: t.exposeString('name'),
    createdAt: t.string({ resolve: (r) => r.created_at ?? '' }),
  }),
});

async function resolveKitchenId(slug: string | null | undefined): Promise<string> {
  const s = slug ?? 'home';
  const [kitchen] = await sql<{ id: string }>`SELECT id FROM kitchens WHERE slug = ${s}`;
  if (!kitchen) throw new Error(`Kitchen not found: ${s}`);
  return kitchen.id;
}

/**
 * Normalize a productMeta input string into a JSON string ready to persist
 * to the `product_meta` TEXT column, or null. Kept permissive: unparseable
 * JSON becomes null rather than 500-ing.
 */
function normalizeProductMeta(input: string | null | undefined): string | null {
  if (input == null || input === '') return null;
  try {
    const parsed = JSON.parse(input);
    if (parsed == null || typeof parsed !== 'object') return null;
    return JSON.stringify(parsed);
  } catch {
    return null;
  }
}

// ── Ingredient ────────────────────────────────────────────────────────────────

const IngredientType = builder.objectType('Ingredient', {
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    category: t.string({ nullable: true, resolve: (r) => r.category }),
    quantity: t.float({ nullable: true, resolve: (r) => r.quantity }),
    unit: t.string({ nullable: true, resolve: (r) => r.unit }),
    itemSize: t.float({ nullable: true, resolve: (r) => r.item_size }),
    itemSizeUnit: t.string({ nullable: true, resolve: (r) => r.item_size_unit }),
    alwaysOnHand: t.boolean({ resolve: (r) => Boolean(r.always_on_hand) }),
    tags: t.stringList({ resolve: (r) => parseJsonArr(r.tags) }),
    aliases: t.stringList({ resolve: (r) => parseJsonArr(r.aliases) }),
    barcode: t.string({ nullable: true, resolve: (r) => r.barcode }),
    /** Serialized JSON string of the ProductMeta payload. Clients/MCP parse as needed. */
    productMeta: t.string({
      nullable: true,
      resolve: (r) => (r.product_meta == null ? null : String(r.product_meta)),
    }),
    /** Explicit best-by date (ISO 8601), set by the user or an agent. Null = estimate from category. */
    expiresAt: t.string({ nullable: true, resolve: (r) => r.expires_at ?? null }),
    /** When this stock last came in: set on add, on a quantity increase, on touch and on merge.
     *  Falls back to createdAt for rows written before the column existed. */
    stockedAt: t.string({ resolve: (r) => r.stocked_at ?? r.created_at ?? '' }),
    updatedAt: t.string({ resolve: (r) => r.updated_at ?? r.created_at ?? '' }),
    createdAt: t.string({ resolve: (r) => r.created_at ?? '' }),
  }),
});

const IngredientInputType = builder.inputType('IngredientInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    category: t.string(),
    quantity: t.float(),
    unit: t.string(),
    itemSize: t.float(),
    itemSizeUnit: t.string(),
    alwaysOnHand: t.boolean(),
    tags: t.stringList(),
    aliases: t.stringList(),
    barcode: t.string(),
    productMeta: t.string(),
    expiresAt: t.string(),
  }),
});

/** One row's patch for `updateIngredients`. Omitted fields are kept;
 *  `expiresAt: null` clears the date. */
const IngredientPatchInputType = builder.inputType('IngredientPatchInput', {
  fields: (t) => ({
    id: t.string({ required: true }),
    name: t.string(),
    category: t.string(),
    quantity: t.float(),
    unit: t.string(),
    itemSize: t.float(),
    itemSizeUnit: t.string(),
    alwaysOnHand: t.boolean(),
    tags: t.stringList(),
    aliases: t.stringList(),
    barcode: t.string(),
    productMeta: t.string(),
    expiresAt: t.string(),
  }),
});

// ── Recipe ────────────────────────────────────────────────────────────────────

const RecipeIngredientType = builder.objectType('RecipeIngredient', {
  fields: (t) => ({
    ingredientName: t.string({ resolve: (r) => r.ingredient_name }),
    quantity: t.float({ nullable: true, resolve: (r) => r.quantity }),
    unit: t.string({ nullable: true, resolve: (r) => r.unit }),
    itemSize: t.float({ nullable: true, resolve: (r) => r.item_size }),
    itemSizeUnit: t.string({ nullable: true, resolve: (r) => r.item_size_unit }),
    sourceRecipeId: t.string({
      nullable: true,
      resolve: async (r) => {
        if (r.source_recipe_id) return r.source_recipe_id;
        const [match] = await sql<{ id: string }>`
          SELECT id FROM recipes
          WHERE lower(title) = ${r.ingredient_name.toLowerCase()}
            AND id != ${r.recipe_id}
          LIMIT 1
        `;
        return match?.id ?? null;
      },
    }),
  }),
});

function toSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-').replace(/-+/g, '-');
}

async function uniqueSlug(title: string, excludeId?: string): Promise<string> {
  const base = toSlug(title);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const [existing] = excludeId
      ? await sql<{ id: string }>`SELECT id FROM recipes WHERE slug = ${candidate} AND id != ${excludeId}`
      : await sql<{ id: string }>`SELECT id FROM recipes WHERE slug = ${candidate}`;
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

/**
 * Populate `sourceRecipeId` on any ingredient row whose name case-insensitively
 * matches an existing recipe title. Keeps the database canonical so both
 * directions of the sub-recipe relationship read from the same column.
 */
async function autoLinkSubRecipeIngredients<T extends { ingredientName: string; sourceRecipeId?: string | null }>(
  ingredients: T[],
  parentRecipeId: string | null,
): Promise<T[]> {
  const unresolved = ingredients.filter((i) => !i.sourceRecipeId && i.ingredientName?.trim());
  if (unresolved.length === 0) return ingredients;
  const names = Array.from(new Set(unresolved.map((i) => i.ingredientName.toLowerCase())));
  const matches: { id: string; title: string }[] = parentRecipeId
    ? await sql`SELECT id, lower(title) AS title FROM recipes WHERE lower(title) IN (${names}) AND id != ${parentRecipeId}`
    : await sql`SELECT id, lower(title) AS title FROM recipes WHERE lower(title) IN (${names})`;
  if (matches.length === 0) return ingredients;
  const byTitle = new Map(matches.map((m) => [m.title, m.id]));
  return ingredients.map((i) => {
    if (i.sourceRecipeId || !i.ingredientName?.trim()) return i;
    const id = byTitle.get(i.ingredientName.toLowerCase());
    return id ? { ...i, sourceRecipeId: id } : i;
  });
}

const RecipeType = builder.objectType('Recipe', {
  fields: (t) => ({
    id: t.exposeString('id'),
    slug: t.string({ nullable: true, resolve: (r) => r.slug ?? null }),
    title: t.exposeString('title'),
    description: t.string({ nullable: true, resolve: (r) => r.description }),
    instructions: t.exposeString('instructions'),
    servings: t.int({ nullable: true, resolve: (r) => r.servings }),
    prepTime: t.int({ nullable: true, resolve: (r) => r.prep_time }),
    cookTime: t.int({ nullable: true, resolve: (r) => r.cook_time }),
    tags: t.stringList({ resolve: (r) => parseJsonArr(r.tags) }),
    requiredCookware: t.field({
      type: [CookwareType],
      resolve: (r) =>
        sql`SELECT c.* FROM cookware c JOIN recipe_cookware rc ON rc.cookware_id = c.id WHERE rc.recipe_id = ${r.id} ORDER BY c.name`,
    }),
    source: t.exposeString('source'),
    sourceUrl: t.string({ nullable: true, resolve: (r) => r.source_url ?? null }),
    photoUrl: t.string({ nullable: true, resolve: (r) => r.photo_url }),
    stepPhotos: t.stringList({ resolve: (r) => parseJsonArr(r.step_photos) }),
    lastMadeAt: t.string({ nullable: true, resolve: (r) => r.last_made_at ?? null }),
    queued: t.boolean({ resolve: (r) => Boolean(r.queued) }),
    ingredients: t.field({
      type: [RecipeIngredientType],
      resolve: async (recipe) => {
        return sql`SELECT * FROM recipe_ingredients WHERE recipe_id = ${recipe.id} ORDER BY sort_order, id`;
      },
    }),
    createdAt: t.string({ resolve: (r) => r.created_at ?? '' }),
    usedIn: t.field({
      type: [RecipeType],
      resolve: async (recipe) =>
        sql`SELECT DISTINCT r.* FROM recipes r
            JOIN recipe_ingredients ri ON ri.recipe_id = r.id
            WHERE ri.recipe_id != ${recipe.id}
              AND (ri.source_recipe_id = ${recipe.id}
                   OR (ri.source_recipe_id IS NULL
                       AND lower(ri.ingredient_name) = ${recipe.title.toLowerCase()}))
            ORDER BY r.title`,
    }),
    groceryIngredients: t.field({
      type: [RecipeIngredientType],
      description: 'Recursively unfurls sub-recipe ingredients for grocery list use',
      resolve: async (recipe) => {
        const rows: any[] = await sql`SELECT * FROM recipe_ingredients WHERE recipe_id = ${recipe.id} ORDER BY sort_order, id`;
        const result: any[] = [];
        for (const row of rows) {
          let subRecipeId = row.source_recipe_id;
          if (!subRecipeId) {
            const [match] = await sql<{ id: string }>`SELECT id FROM recipes WHERE lower(title) = ${row.ingredient_name.toLowerCase()} AND id != ${recipe.id} LIMIT 1`;
            if (match) subRecipeId = match.id;
          }
          if (subRecipeId) {
            const subRows: any[] = await sql`SELECT * FROM recipe_ingredients WHERE recipe_id = ${subRecipeId} ORDER BY sort_order, id`;
            for (const sub of subRows) {
              result.push({
                ...sub,
                quantity: (sub.quantity != null && row.quantity != null)
                  ? sub.quantity * row.quantity
                  : sub.quantity,
              });
            }
          } else {
            result.push(row);
          }
        }
        const merged = new Map<string, any>();
        for (const item of result) {
          const key = `${item.ingredient_name.toLowerCase()}::${(item.unit ?? '').toLowerCase()}`;
          const existing = merged.get(key);
          if (existing) {
            if (existing.quantity != null && item.quantity != null) {
              existing.quantity = Number(existing.quantity) + Number(item.quantity);
            }
          } else {
            merged.set(key, { ...item });
          }
        }
        return [...merged.values()];
      },
    }),
  }),
});

const RecipeIngredientInputType = builder.inputType('RecipeIngredientInput', {
  fields: (t) => ({
    ingredientName: t.string({ required: true }),
    quantity: t.float(),
    unit: t.string(),
    itemSize: t.float(),
    itemSizeUnit: t.string(),
    sourceRecipeId: t.string(),
  }),
});

// ── Cookware ──────────────────────────────────────────────────────────────────

const CookwareType = builder.objectType('Cookware', {
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    brand: t.string({ nullable: true, resolve: (r) => r.brand }),
    tags: t.stringList({ resolve: (r) => parseJsonArr(r.tags) }),
    notes: t.string({ nullable: true, resolve: (r) => r.notes }),
    createdAt: t.string({ resolve: (r) => r.created_at ?? '' }),
    recipes: t.field({
      type: [RecipeType],
      resolve: async (cookware) =>
        sql`SELECT r.* FROM recipes r JOIN recipe_cookware rc ON rc.recipe_id = r.id WHERE rc.cookware_id = ${cookware.id} ORDER BY r.title`,
    }),
  }),
});

// ── Menus ─────────────────────────────────────────────────────────────────────

const MenuRecipeType = builder.objectType('MenuRecipe', {
  fields: (t) => ({
    id: t.exposeString('id'),
    course: t.string({ nullable: true, resolve: (r) => r.course }),
    sortOrder: t.int({ resolve: (r) => r.sort_order ?? 0 }),
    recipe: t.field({
      type: RecipeType,
      resolve: async (mr) => {
        const [row] = await sql`SELECT * FROM recipes WHERE id = ${mr.recipe_id}`;
        return row;
      },
    }),
  }),
});

const MenuType = builder.objectType('Menu', {
  fields: (t) => ({
    id: t.exposeString('id'),
    slug: t.string({ nullable: true, resolve: (r) => r.slug ?? null }),
    title: t.exposeString('title'),
    description: t.string({ nullable: true, resolve: (r) => r.description }),
    active: t.boolean({ resolve: (r) => Boolean(r.active ?? 1) }),
    category: t.string({ nullable: true, resolve: (r) => r.category ?? null }),
    sourceUrl: t.string({ nullable: true, resolve: (r) => r.source_url ?? null }),
    createdAt: t.string({ resolve: (r) => r.created_at ?? '' }),
    recipes: t.field({
      type: [MenuRecipeType],
      resolve: async (menu) =>
        sql`SELECT * FROM menu_recipes WHERE menu_id = ${menu.id} ORDER BY course, sort_order`,
    }),
  }),
});

const MenuRecipeInputType = builder.inputType('MenuRecipeInput', {
  fields: (t) => ({
    recipeId: t.string({ required: true }),
    course: t.string(),
    sortOrder: t.int(),
  }),
});

async function uniqueMenuSlug(title: string, excludeId?: string): Promise<string> {
  const base = toSlug(title);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const [existing] = excludeId
      ? await sql<{ id: string }>`SELECT id FROM menus WHERE slug = ${candidate} AND id != ${excludeId}`
      : await sql<{ id: string }>`SELECT id FROM menus WHERE slug = ${candidate}`;
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryField('ingredients', (t) =>
  t.field({
    type: [IngredientType],
    args: { name: t.arg.string(), tags: t.arg.stringList(), kitchenSlug: t.arg.string() },
    resolve: async (_, { name, tags, kitchenSlug }) => {
      const kitchenId = await resolveKitchenId(kitchenSlug);
      const hasTags = !!tags?.length;
      const hasName = !!name;
      // Tag containment (PG `tags @> ARRAY[...]`) → JSON1 helper:
      //   NOT EXISTS (any query tag missing from row tags)
      if (hasName && hasTags) {
        return sql`
          SELECT * FROM ingredients
          WHERE kitchen_id = ${kitchenId}
            AND name LIKE ${'%' + name + '%'} COLLATE NOCASE
            AND NOT EXISTS (
              SELECT 1 FROM json_each(${JSON.stringify(tags)}) AS q
              WHERE q.value NOT IN (SELECT value FROM json_each(tags))
            )
          ORDER BY name
        `;
      }
      if (hasName) {
        return sql`SELECT * FROM ingredients WHERE kitchen_id = ${kitchenId} AND name LIKE ${'%' + name + '%'} COLLATE NOCASE ORDER BY name`;
      }
      if (hasTags) {
        return sql`
          SELECT * FROM ingredients
          WHERE kitchen_id = ${kitchenId}
            AND NOT EXISTS (
              SELECT 1 FROM json_each(${JSON.stringify(tags)}) AS q
              WHERE q.value NOT IN (SELECT value FROM json_each(tags))
            )
          ORDER BY name
        `;
      }
      return sql`SELECT * FROM ingredients WHERE kitchen_id = ${kitchenId} ORDER BY name`;
    },
  }),
);

builder.queryField('recipes', (t) =>
  t.field({
    type: [RecipeType],
    args: { title: t.arg.string(), tags: t.arg.stringList(), cookware: t.arg.stringList(), queued: t.arg.boolean(), kitchenSlug: t.arg.string() },
    resolve: async (_, { title, tags, cookware, queued, kitchenSlug }) => {
      const kitchenId = await resolveKitchenId(kitchenSlug);
      if (title) {
        return sql`SELECT * FROM recipes WHERE kitchen_id = ${kitchenId} AND title LIKE ${'%' + title + '%'} COLLATE NOCASE ORDER BY created_at DESC`;
      }
      // Tag overlap (PG `tags && ARRAY[...]`) → EXISTS over json_each + IN (...)
      if (tags?.length && cookware?.length) {
        return sql`
          SELECT DISTINCT r.* FROM recipes r
          JOIN recipe_cookware rc ON rc.recipe_id = r.id
          WHERE r.kitchen_id = ${kitchenId}
            AND EXISTS (SELECT 1 FROM json_each(r.tags) AS rt WHERE rt.value IN (${tags}))
            AND rc.cookware_id IN (${cookware})
          ORDER BY r.created_at DESC
        `;
      }
      if (tags?.length) {
        return sql`
          SELECT * FROM recipes
          WHERE kitchen_id = ${kitchenId}
            AND EXISTS (SELECT 1 FROM json_each(tags) AS rt WHERE rt.value IN (${tags}))
          ORDER BY created_at DESC
        `;
      }
      if (cookware?.length) {
        return sql`
          SELECT DISTINCT r.* FROM recipes r
          JOIN recipe_cookware rc ON rc.recipe_id = r.id
          WHERE r.kitchen_id = ${kitchenId} AND rc.cookware_id IN (${cookware})
          ORDER BY r.created_at DESC
        `;
      }
      if (queued != null) {
        return sql`SELECT * FROM recipes WHERE kitchen_id = ${kitchenId} AND queued = ${queued ? 1 : 0} ORDER BY created_at DESC`;
      }
      return sql`SELECT * FROM recipes WHERE kitchen_id = ${kitchenId} ORDER BY created_at DESC`;
    },
  }),
);

builder.queryField('recipe', (t) =>
  t.field({
    type: RecipeType,
    nullable: true,
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      const [row] = await sql`SELECT * FROM recipes WHERE slug = ${id} OR id = ${id}`;
      return row ?? null;
    },
  }),
);

builder.queryField('cookware', (t) =>
  t.field({
    type: [CookwareType],
    args: { kitchenSlug: t.arg.string() },
    resolve: async (_, { kitchenSlug }) => {
      const kitchenId = await resolveKitchenId(kitchenSlug);
      return sql`SELECT * FROM cookware WHERE kitchen_id = ${kitchenId} ORDER BY name`;
    },
  }),
);

builder.queryField('cookwareItem', (t) =>
  t.field({
    type: CookwareType,
    nullable: true,
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      const [row] = await sql`SELECT * FROM cookware WHERE id = ${id}`;
      return row ?? null;
    },
  }),
);

builder.queryField('kitchens', (t) =>
  t.field({
    type: [KitchenType],
    resolve: async () => sql`SELECT * FROM kitchens ORDER BY created_at`,
  }),
);

builder.queryField('kitchen', (t) =>
  t.field({
    type: KitchenType,
    nullable: true,
    args: { slug: t.arg.string({ required: true }) },
    resolve: async (_, { slug }) => {
      const [row] = await sql`SELECT * FROM kitchens WHERE slug = ${slug}`;
      return row ?? null;
    },
  }),
);

// ── Queries — Menu ───────────────────────────────────────────────────────────

builder.queryField('menus', (t) =>
  t.field({
    type: [MenuType],
    args: { kitchenSlug: t.arg.string() },
    resolve: async (_, { kitchenSlug }) => {
      const kitchenId = await resolveKitchenId(kitchenSlug);
      return sql`SELECT * FROM menus WHERE kitchen_id = ${kitchenId} ORDER BY created_at DESC`;
    },
  }),
);

builder.queryField('menu', (t) =>
  t.field({
    type: MenuType,
    nullable: true,
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      const [row] = await sql`SELECT * FROM menus WHERE slug = ${id} OR id = ${id}`;
      return row ?? null;
    },
  }),
);

// ── Mutations — Ingredient ────────────────────────────────────────────────────

builder.mutationField('addIngredient', (t) =>
  t.field({
    type: IngredientType,
    args: {
      name: t.arg.string({ required: true }),
      category: t.arg.string(),
      quantity: t.arg.float(),
      unit: t.arg.string(),
      itemSize: t.arg.float(),
      itemSizeUnit: t.arg.string(),
      alwaysOnHand: t.arg.boolean(),
      tags: t.arg.stringList(),
      aliases: t.arg.stringList(),
      barcode: t.arg.string(),
      productMeta: t.arg.string(),
      expiresAt: t.arg.string(),
      kitchenSlug: t.arg.string(),
    },
    resolve: async (_, args) => {
      const kitchenId = await resolveKitchenId(args.kitchenSlug);
      const productMetaJson = normalizeProductMeta(args.productMeta);
      const [row] = await sql`
        INSERT INTO ingredients (id, name, category, quantity, unit, item_size, item_size_unit, always_on_hand, tags, aliases, barcode, product_meta, expires_at, stocked_at, kitchen_id)
        VALUES (
          ${randomUUID()},
          ${args.name},
          ${args.category ?? null},
          ${args.quantity ?? null},
          ${args.unit ?? null},
          ${args.itemSize ?? null},
          ${args.itemSizeUnit ?? null},
          ${args.alwaysOnHand ? 1 : 0},
          ${JSON.stringify(args.tags ?? [])},
          ${args.aliases ? JSON.stringify(args.aliases) : null},
          ${args.barcode ?? null},
          ${productMetaJson},
          ${args.expiresAt ?? null},
          ${nowIso()},
          ${kitchenId}
        )
        RETURNING *
      `;
      return row;
    },
  }),
);

builder.mutationField('addIngredients', (t) =>
  t.field({
    type: [IngredientType],
    args: { inputs: t.arg({ type: [IngredientInputType], required: true }), kitchenSlug: t.arg.string() },
    resolve: async (_, { inputs, kitchenSlug }) => {
      if (inputs.length === 0) return [];
      const kitchenId = await resolveKitchenId(kitchenSlug);
      const rows = await bulkInsert(
        'ingredients',
        inputs.map((i) => ({
          id: randomUUID(),
          name: i.name,
          category: i.category ?? null,
          quantity: i.quantity ?? null,
          unit: i.unit ?? null,
          item_size: i.itemSize ?? null,
          item_size_unit: i.itemSizeUnit ?? null,
          always_on_hand: i.alwaysOnHand ? 1 : 0,
          tags: JSON.stringify(i.tags ?? []),
          aliases: i.aliases ? JSON.stringify(i.aliases) : null,
          barcode: i.barcode ?? null,
          product_meta: normalizeProductMeta(i.productMeta),
          expires_at: i.expiresAt ?? null,
          stocked_at: nowIso(),
          kitchen_id: kitchenId,
        })),
        ['id', 'name', 'category', 'quantity', 'unit', 'item_size', 'item_size_unit', 'always_on_hand', 'tags', 'aliases', 'barcode', 'product_meta', 'expires_at', 'stocked_at', 'kitchen_id'],
      );
      return rows;
    },
  }),
);

type IngredientPatch = {
  name?: string | null;
  category?: string | null;
  quantity?: number | null;
  unit?: string | null;
  itemSize?: number | null;
  itemSizeUnit?: string | null;
  alwaysOnHand?: boolean | null;
  tags?: string[] | null;
  aliases?: string[] | null;
  barcode?: string | null;
  productMeta?: string | null;
  expiresAt?: string | null;
};

/**
 * One UPDATE behind both update mutations.
 *
 * `quantityMode`:
 *   - 'replace' (updateIngredient): quantity and unit are written as given,
 *     so omitting them clears them. The edit form always sends both.
 *   - 'keep' (updateIngredients): omitted fields are left alone, so a bulk
 *     patch that only sets expiresAt can't wipe quantities; an explicit
 *     `quantity: null` / `unit: null` clears them (back to "untracked"),
 *     which is how the review's Undo restores a row that had no quantity.
 *
 * `expiresAt`: omitted keeps, null clears, a string sets. `stocked_at` moves
 * to now only when the quantity goes up; `updated_at` always moves.
 */
async function patchIngredient(id: string, p: IngredientPatch, quantityMode: 'replace' | 'keep') {
  const now = nowIso();
  const productMetaJson = p.productMeta === undefined ? undefined : normalizeProductMeta(p.productMeta);
  const aohTrue = p.alwaysOnHand === true ? 1 : 0;
  // In 'keep' mode an omitted field is kept and an explicit null clears it;
  // in 'replace' mode both write what was given (null included).
  const keepQty = quantityMode === 'keep' && p.quantity === undefined ? 1 : 0;
  const keepUnit = quantityMode === 'keep' && p.unit === undefined ? 1 : 0;
  const keepExpires = p.expiresAt === undefined ? 1 : 0;
  const qty = p.quantity ?? null;
  const unit = p.unit ?? null;
  const [row] = await sql`
    UPDATE ingredients SET
      name = COALESCE(${p.name ?? null}, name),
      category = COALESCE(${p.category ?? null}, category),
      always_on_hand = COALESCE(${p.alwaysOnHand == null ? null : (p.alwaysOnHand ? 1 : 0)}, always_on_hand),
      quantity = CASE WHEN ${aohTrue} = 1 THEN NULL WHEN ${keepQty} = 1 THEN quantity ELSE ${qty} END,
      unit = CASE WHEN ${aohTrue} = 1 THEN NULL WHEN ${keepUnit} = 1 THEN unit ELSE ${unit} END,
      item_size = COALESCE(${p.itemSize ?? null}, item_size),
      item_size_unit = COALESCE(${p.itemSizeUnit ?? null}, item_size_unit),
      tags = COALESCE(${p.tags ? JSON.stringify(p.tags) : null}, tags),
      aliases = COALESCE(${p.aliases ? JSON.stringify(p.aliases) : null}, aliases),
      barcode = COALESCE(${p.barcode ?? null}, barcode),
      product_meta = COALESCE(${productMetaJson ?? null}, product_meta),
      expires_at = CASE WHEN ${keepExpires} = 1 THEN expires_at ELSE ${p.expiresAt ?? null} END,
      stocked_at = CASE WHEN ${qty} IS NOT NULL AND ${qty} > COALESCE(quantity, 0) THEN ${now} ELSE stocked_at END,
      updated_at = ${now}
    WHERE id = ${id}
    RETURNING *
  `;
  return row;
}

builder.mutationField('updateIngredient', (t) =>
  t.field({
    type: IngredientType,
    args: {
      id: t.arg.string({ required: true }),
      name: t.arg.string(),
      category: t.arg.string(),
      quantity: t.arg.float(),
      unit: t.arg.string(),
      itemSize: t.arg.float(),
      itemSizeUnit: t.arg.string(),
      alwaysOnHand: t.arg.boolean(),
      tags: t.arg.stringList(),
      aliases: t.arg.stringList(),
      barcode: t.arg.string(),
      productMeta: t.arg.string(),
      expiresAt: t.arg.string({ description: 'Omit to keep, pass null to clear, or an ISO 8601 date to set.' }),
    },
    resolve: async (_, { id, ...patch }) => patchIngredient(id, patch, 'replace'),
  }),
);

builder.mutationField('updateIngredients', (t) =>
  t.field({
    type: [IngredientType],
    description: 'Patch many pantry rows in one transaction. Omitted fields are kept; an explicit null clears `quantity`, `unit` or `expiresAt`. Returns rows in input order.',
    args: { inputs: t.arg({ type: [IngredientPatchInputType], required: true }) },
    resolve: async (_, { inputs }) => {
      if (inputs.length === 0) return [];
      return withTransaction(async () => {
        const rows = [];
        for (const { id, ...patch } of inputs) {
          const row = await patchIngredient(id, patch, 'keep');
          if (!row) throw new Error(`Ingredient not found: ${id}`);
          rows.push(row);
        }
        return rows;
      });
    },
  }),
);

builder.mutationField('deleteIngredients', (t) =>
  t.field({
    type: 'Int',
    description: 'Delete many pantry rows at once. Returns how many were deleted.',
    args: { ids: t.arg.stringList({ required: true }) },
    resolve: async (_, { ids }) => {
      if (ids.length === 0) return 0;
      const rows = await sql`DELETE FROM ingredients WHERE id IN (${ids}) RETURNING id`;
      return rows.length;
    },
  }),
);

builder.mutationField('touchIngredients', (t) =>
  t.field({
    type: [IngredientType],
    description: '"Still have it": marks rows as freshly stocked (stockedAt and updatedAt = now) without changing quantities.',
    args: { ids: t.arg.stringList({ required: true }) },
    resolve: async (_, { ids }) => {
      if (ids.length === 0) return [];
      const now = nowIso();
      return sql`UPDATE ingredients SET stocked_at = ${now}, updated_at = ${now} WHERE id IN (${ids}) RETURNING *`;
    },
  }),
);

const MergeIngredientsResultType = builder.objectType('MergeIngredientsResult', {
  fields: (t) => ({
    ingredient: t.field({ type: IngredientType, resolve: (r) => r.ingredient }),
    mergedIds: t.stringList({ resolve: (r) => r.mergedIds }),
    /** Names of merged rows whose quantity could not be added to the survivor (incompatible units or item sizes). */
    unmergedQuantities: t.stringList({ resolve: (r) => r.unmergedQuantities }),
  }),
});

type IngredientRow = {
  id: string; name: string; category: string | null; quantity: number | null; unit: string | null;
  item_size: number | null; item_size_unit: string | null; always_on_hand: number; tags: string | null;
  aliases: string | null; barcode: string | null; product_meta: string | null; expires_at: string | null;
  stocked_at: string | null; created_at: string; kitchen_id: string;
};

builder.mutationField('mergeIngredients', (t) =>
  t.field({
    type: MergeIngredientsResultType,
    description:
      'Merge duplicate pantry rows into a survivor. Quantities are summed when units and item sizes are compatible, tags and aliases are unioned, the merged names become aliases of the survivor, the earliest expiry and the latest stockedAt win, and the merged rows are deleted.',
    args: {
      survivorId: t.arg.string({ required: true }),
      mergeIds: t.arg.stringList({ required: true }),
    },
    resolve: async (_, { survivorId, mergeIds }) => {
      const [survivor] = await sql<IngredientRow>`SELECT * FROM ingredients WHERE id = ${survivorId}`;
      if (!survivor) throw new Error('Ingredient not found');
      const ids = [...new Set(mergeIds)].filter((x) => x !== survivorId);
      const others = ids.length
        ? await sql<IngredientRow>`SELECT * FROM ingredients WHERE id IN (${ids}) AND kitchen_id = ${survivor.kitchen_id}`
        : [];
      if (others.length === 0) return { ingredient: survivor, mergedIds: [], unmergedQuantities: [] };

      const lower = (x: string) => x.toLowerCase();
      let quantity = survivor.quantity;
      const unmerged: string[] = [];
      const tags = parseJsonArr(survivor.tags);
      const aliases = parseJsonArr(survivor.aliases);
      const seenTags = new Set(tags.map(lower));
      const seenAliases = new Set([lower(survivor.name), ...aliases.map(lower)]);
      let { barcode, product_meta: productMeta, category, expires_at: expiresAt } = survivor;
      let stockedAt = survivor.stocked_at ?? survivor.created_at;

      for (const o of others) {
        if (!survivor.always_on_hand && o.quantity != null) {
          const sameSize =
            (survivor.item_size ?? null) === (o.item_size ?? null) &&
            normalizeUnit(survivor.item_size_unit) === normalizeUnit(o.item_size_unit);
          const add = !survivor.unit && !o.unit ? o.quantity : convert(o.quantity, o.unit, survivor.unit);
          if (sameSize && add != null) quantity = (quantity ?? 0) + add;
          else unmerged.push(o.name);
        }
        for (const tag of parseJsonArr(o.tags)) {
          if (!seenTags.has(lower(tag))) { seenTags.add(lower(tag)); tags.push(tag); }
        }
        for (const alias of [o.name, ...parseJsonArr(o.aliases)]) {
          if (!seenAliases.has(lower(alias))) { seenAliases.add(lower(alias)); aliases.push(alias); }
        }
        barcode ??= o.barcode;
        productMeta ??= o.product_meta;
        category ??= o.category;
        if (o.expires_at && (!expiresAt || o.expires_at < expiresAt)) expiresAt = o.expires_at;
        const oStocked = o.stocked_at ?? o.created_at;
        if (oStocked > stockedAt) stockedAt = oStocked;
      }

      const now = nowIso();
      const ingredient = await withTransaction(async () => {
        const [row] = await sql`
          UPDATE ingredients SET
            quantity = ${quantity},
            category = ${category},
            tags = ${JSON.stringify(tags)},
            aliases = ${JSON.stringify(aliases)},
            barcode = ${barcode},
            product_meta = ${productMeta},
            expires_at = ${expiresAt},
            stocked_at = ${stockedAt},
            updated_at = ${now}
          WHERE id = ${survivorId}
          RETURNING *
        `;
        await sql`DELETE FROM ingredients WHERE id IN (${others.map((o) => o.id)})`;
        return row;
      });
      return { ingredient, mergedIds: others.map((o) => o.id), unmergedQuantities: unmerged };
    },
  }),
);

builder.mutationField('deleteIngredient', (t) =>
  t.field({
    type: 'Boolean',
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      await sql`DELETE FROM ingredients WHERE id = ${id}`;
      return true;
    },
  }),
);

// ── Mutations — Recipe ────────────────────────────────────────────────────────

async function insertRecipe(
  data: {
    title: string;
    description?: string | null;
    instructions: string;
    servings?: number | null;
    prepTime?: number | null;
    cookTime?: number | null;
    tags?: string[] | null;
    requiredCookwareIds?: string[] | null;
    source?: string;
    sourceUrl?: string | null;
    photoUrl?: string | null;
    stepPhotos?: string[] | null;
    kitchenId?: string;
  },
  ingredients: { ingredientName: string; quantity?: number | null; unit?: string | null; itemSize?: number | null; itemSizeUnit?: string | null; sourceRecipeId?: string | null }[],
) {
  const kitchenId = data.kitchenId ?? await resolveKitchenId('home');
  const slug = await uniqueSlug(data.title);
  const recipeId = randomUUID();

  const instructions = data.instructions.replace(/\\n/g, '\n');

  const [recipe] = await sql`
    INSERT INTO recipes (id, title, slug, description, instructions, servings, prep_time, cook_time, tags, source, source_url, photo_url, step_photos, kitchen_id)
    VALUES (
      ${recipeId},
      ${data.title},
      ${slug},
      ${data.description ?? null},
      ${instructions},
      ${data.servings ?? 2},
      ${data.prepTime ?? null},
      ${data.cookTime ?? null},
      ${JSON.stringify(data.tags ?? [])},
      ${data.source ?? 'manual'},
      ${data.sourceUrl ?? null},
      ${data.photoUrl ?? null},
      ${JSON.stringify(data.stepPhotos ?? [])},
      ${kitchenId}
    )
    RETURNING *
  `;

  if (data.requiredCookwareIds?.length) {
    for (const cookwareId of data.requiredCookwareIds) {
      await sql`INSERT INTO recipe_cookware (recipe_id, cookware_id) VALUES (${recipe.id}, ${cookwareId}) ON CONFLICT DO NOTHING`;
    }
  }

  if (ingredients.length > 0) {
    const linked = await autoLinkSubRecipeIngredients(ingredients, recipe.id);
    await bulkInsert(
      'recipe_ingredients',
      linked.map((i, idx) => ({
        id: randomUUID(),
        recipe_id: recipe.id,
        ingredient_name: i.ingredientName,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
        item_size: i.itemSize ?? null,
        item_size_unit: i.itemSizeUnit ?? null,
        source_recipe_id: i.sourceRecipeId ?? null,
        sort_order: idx,
      })),
      ['id', 'recipe_id', 'ingredient_name', 'quantity', 'unit', 'item_size', 'item_size_unit', 'source_recipe_id', 'sort_order'],
    );
  }

  if (typeof recipe.photo_url === 'string' && recipe.photo_url.startsWith('/uploads/')) {
    const uploadsDir = join(process.cwd(), 'public', 'uploads');
    copyFriendlyPhoto(recipe.photo_url, recipe.slug, uploadsDir).catch(() => {});
  }

  return recipe;
}

builder.mutationField('createRecipe', (t) =>
  t.field({
    type: RecipeType,
    args: {
      title: t.arg.string({ required: true }),
      description: t.arg.string(),
      instructions: t.arg.string({ required: true }),
      servings: t.arg.int(),
      prepTime: t.arg.int(),
      cookTime: t.arg.int(),
      tags: t.arg.stringList(),
      requiredCookwareIds: t.arg.stringList(),
      photoUrl: t.arg.string(),
      stepPhotos: t.arg.stringList(),
      sourceUrl: t.arg.string(),
      ingredients: t.arg({ type: [RecipeIngredientInputType], required: true }),
      kitchenSlug: t.arg.string(),
    },
    resolve: async (_, args) => {
      const kitchenId = await resolveKitchenId(args.kitchenSlug);

      // 60s idempotency guard. Cutoff computed in JS to keep the SQL portable
      // (no PG `INTERVAL`); created_at is stored as ISO 8601 UTC so lex
      // comparison works correctly.
      const cutoff = new Date(Date.now() - 60_000).toISOString();
      const [recent] = await sql`
        SELECT * FROM recipes
        WHERE kitchen_id = ${kitchenId}
          AND lower(title) = ${args.title.toLowerCase()}
          AND created_at > ${cutoff}
        ORDER BY created_at DESC
        LIMIT 1
      `;
      if (recent) return recent;

      return insertRecipe(
        {
          title: args.title,
          description: args.description,
          instructions: args.instructions,
          servings: args.servings,
          prepTime: args.prepTime,
          cookTime: args.cookTime,
          tags: args.tags,
          requiredCookwareIds: args.requiredCookwareIds,
          photoUrl: args.photoUrl,
          stepPhotos: args.stepPhotos,
          sourceUrl: args.sourceUrl,
          source: args.sourceUrl ? 'url-import' : 'manual',
          kitchenId,
        },
        args.ingredients,
      );
    },
  }),
);

builder.mutationField('updateRecipe', (t) =>
  t.field({
    type: RecipeType,
    args: {
      id: t.arg.string({ required: true }),
      title: t.arg.string(),
      description: t.arg.string(),
      instructions: t.arg.string(),
      servings: t.arg.int(),
      prepTime: t.arg.int(),
      cookTime: t.arg.int(),
      tags: t.arg.stringList(),
      requiredCookwareIds: t.arg.stringList(),
      photoUrl: t.arg.string(),
      stepPhotos: t.arg.stringList(),
      sourceUrl: t.arg.string(),
      ingredients: t.arg({ type: [RecipeIngredientInputType] }),
    },
    resolve: async (_, args) => {
      const newSlug = args.title ? await uniqueSlug(args.title, args.id) : null;
      const photoUrlArg = args.photoUrl;
      const [recipe] = await sql`
        UPDATE recipes SET
          title = COALESCE(${args.title ?? null}, title),
          slug  = COALESCE(${newSlug}, slug),
          description = COALESCE(${args.description ?? null}, description),
          instructions = COALESCE(${args.instructions ?? null}, instructions),
          servings = COALESCE(${args.servings ?? null}, servings),
          prep_time = COALESCE(${args.prepTime ?? null}, prep_time),
          cook_time = COALESCE(${args.cookTime ?? null}, cook_time),
          tags = COALESCE(${args.tags ? JSON.stringify(args.tags) : null}, tags),
          photo_url = CASE
            WHEN ${photoUrlArg === undefined ? null : photoUrlArg} IS NULL THEN photo_url
            WHEN ${photoUrlArg === undefined ? null : photoUrlArg} = '' THEN NULL
            ELSE ${photoUrlArg === undefined ? null : photoUrlArg}
          END,
          step_photos = COALESCE(${args.stepPhotos ? JSON.stringify(args.stepPhotos) : null}, step_photos),
          source_url = COALESCE(${args.sourceUrl ?? null}, source_url),
          source = CASE
            WHEN ${args.sourceUrl ?? null} IS NOT NULL THEN 'url-import'
            ELSE source
          END
        WHERE id = ${args.id}
        RETURNING *
      `;

      if (args.requiredCookwareIds != null) {
        await sql`DELETE FROM recipe_cookware WHERE recipe_id = ${args.id}`;
        for (const cookwareId of args.requiredCookwareIds) {
          await sql`INSERT INTO recipe_cookware (recipe_id, cookware_id) VALUES (${args.id}, ${cookwareId}) ON CONFLICT DO NOTHING`;
        }
      }

      if (args.ingredients) {
        await sql`DELETE FROM recipe_ingredients WHERE recipe_id = ${args.id}`;
        if (args.ingredients.length > 0) {
          const linked = await autoLinkSubRecipeIngredients(
            args.ingredients.map((i) => ({
              ingredientName: i.ingredientName,
              quantity: i.quantity ?? null,
              unit: i.unit ?? null,
              itemSize: i.itemSize ?? null,
              itemSizeUnit: i.itemSizeUnit ?? null,
              sourceRecipeId: i.sourceRecipeId ?? null,
            })),
            args.id,
          );
          await bulkInsert(
            'recipe_ingredients',
            linked.map((i, idx) => ({
              id: randomUUID(),
              recipe_id: args.id,
              ingredient_name: i.ingredientName,
              quantity: i.quantity ?? null,
              unit: i.unit ?? null,
              item_size: i.itemSize ?? null,
              item_size_unit: i.itemSizeUnit ?? null,
              source_recipe_id: i.sourceRecipeId ?? null,
              sort_order: idx,
            })),
            ['id', 'recipe_id', 'ingredient_name', 'quantity', 'unit', 'item_size', 'item_size_unit', 'source_recipe_id', 'sort_order'],
          );
        }
      }

      if (typeof recipe.photo_url === 'string' && recipe.photo_url.startsWith('/uploads/')) {
        const uploadsDir = join(process.cwd(), 'public', 'uploads');
        copyFriendlyPhoto(recipe.photo_url, recipe.slug, uploadsDir).catch(() => {});
      }

      return recipe;
    },
  }),
);

builder.mutationField('deleteRecipe', (t) =>
  t.field({
    type: 'Boolean',
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      await sql`DELETE FROM recipes WHERE id = ${id}`;
      return true;
    },
  }),
);

builder.mutationField('completeRecipe', (t) =>
  t.field({
    type: RecipeType,
    description: 'Sets lastMadeAt only; the pantry is untouched. Use cookRecipe to also decrement the pantry.',
    args: {
      id: t.arg.string({ required: true }),
      servings: t.arg.int(),
    },
    resolve: async (_, { id }) => {
      const [updated] = await sql`UPDATE recipes SET last_made_at = ${nowIso()} WHERE id = ${id} RETURNING *`;
      if (!updated) throw new Error('Recipe not found');
      return updated;
    },
  }),
);

const PantryChangeType = builder.objectType('PantryChange', {
  description:
    'What cooking a recipe did (or would do) to one pantry row. `status`: decremented | unmatched | always_on_hand | untracked | no_quantity | unconvertible. `before` and `after` are in the pantry row\'s own unit.',
  fields: (t) => ({
    recipeIngredient: t.string({ resolve: (r) => r.recipeIngredient }),
    ingredientId: t.string({ nullable: true, resolve: (r) => r.ingredientId }),
    pantryName: t.string({ nullable: true, resolve: (r) => r.pantryName }),
    before: t.float({ nullable: true, resolve: (r) => r.before }),
    after: t.float({ nullable: true, resolve: (r) => r.after }),
    unit: t.string({ nullable: true, resolve: (r) => r.unit }),
    status: t.string({ resolve: (r) => r.status }),
  }),
});

const CookRecipeResultType = builder.objectType('CookRecipeResult', {
  fields: (t) => ({
    recipe: t.field({ type: RecipeType, resolve: (r) => r.recipe }),
    pantryChanges: t.field({ type: [PantryChangeType], resolve: (r) => r.pantryChanges }),
    /** False on a dry run: nothing was written. */
    applied: t.boolean({ resolve: (r) => r.applied }),
  }),
});

builder.mutationField('cookRecipe', (t) =>
  t.field({
    type: CookRecipeResultType,
    description:
      'Record that a recipe was cooked and decrement the matching pantry rows. `servings` scales the recipe (default: as written). `dryRun: true` returns the plan without writing anything, so clients can preview. `decrementPantry: false` only sets lastMadeAt.',
    args: {
      id: t.arg.string({ required: true }),
      servings: t.arg.int(),
      decrementPantry: t.arg.boolean({ defaultValue: true }),
      dryRun: t.arg.boolean({ defaultValue: false }),
    },
    resolve: async (_, { id, servings, decrementPantry, dryRun }) => {
      const [recipe] = await sql<{ id: string; servings: number | null; kitchen_id: string }>`SELECT * FROM recipes WHERE id = ${id}`;
      if (!recipe) throw new Error('Recipe not found');
      let pantryChanges: PantryChange[] = [];
      if (decrementPantry !== false) {
        const lines = await sql<{ ingredient_name: string; quantity: number | null; unit: string | null; item_size: number | null; item_size_unit: string | null }>`
          SELECT * FROM recipe_ingredients WHERE recipe_id = ${id} ORDER BY sort_order, id`;
        const pantry = await sql<IngredientRow>`SELECT * FROM ingredients WHERE kitchen_id = ${recipe.kitchen_id}`;
        pantryChanges = planPantryDecrement({
          recipeServings: recipe.servings,
          servings,
          lines: lines.map((l) => ({ ingredientName: l.ingredient_name, quantity: l.quantity, unit: l.unit, itemSize: l.item_size, itemSizeUnit: l.item_size_unit })),
          pantry: pantry.map((p) => ({ id: p.id, name: p.name, aliases: parseJsonArr(p.aliases), quantity: p.quantity, unit: p.unit, itemSize: p.item_size, itemSizeUnit: p.item_size_unit, alwaysOnHand: Boolean(p.always_on_hand) })),
        });
      }
      if (dryRun) return { recipe, pantryChanges, applied: false };
      const now = nowIso();
      const updated = await withTransaction(async () => {
        const [r] = await sql`UPDATE recipes SET last_made_at = ${now} WHERE id = ${id} RETURNING *`;
        for (const c of pantryChanges) {
          if (c.status !== 'decremented' || !c.ingredientId) continue;
          await sql`UPDATE ingredients SET quantity = ${c.after}, updated_at = ${now} WHERE id = ${c.ingredientId}`;
        }
        return r;
      });
      return { recipe: updated, pantryChanges, applied: true };
    },
  }),
);

builder.mutationField('toggleRecipeQueued', (t) =>
  t.field({
    type: RecipeType,
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      const [updated] = await sql`UPDATE recipes SET queued = CASE WHEN queued = 1 THEN 0 ELSE 1 END WHERE id = ${id} RETURNING *`;
      if (!updated) throw new Error('Recipe not found');
      return updated;
    },
  }),
);

builder.mutationField('generateRecipes', (t) =>
  t.field({
    type: [RecipeType],
    description:
      'Experimental. Invents three recipes from scratch out of the current pantry and cookware and saves them as ai-generated. Results are untested ideas, not reliable recipes; adapting existing recipes is the stronger use of AI.',
    resolve: async () => {
      const ingredients = await sql`SELECT * FROM ingredients ORDER BY name`;
      const cookware = await sql`SELECT * FROM cookware ORDER BY name`;
      const nameToId = Object.fromEntries((cookware as any[]).map((c) => [c.name, c.id]));
      // SQLite stores tags as a JSON-encoded TEXT — parse before passing into
      // claude.ts, which expects `tags: string[]`.
      const cookwareForAi = (cookware as any[]).map((c) => ({
        ...c,
        tags: parseJsonArr(c.tags),
      }));
      const generated = await aiGenerateRecipes(ingredients, cookwareForAi);
      return Promise.all(
        generated.map((r) => {
          const requiredCookwareIds = (r.requiredCookware ?? [])
            .map((n: string) => nameToId[n])
            .filter(Boolean);
          return insertRecipe(
            {
              title: r.title,
              description: r.description,
              instructions: r.instructions,
              servings: r.servings ?? 2,
              prepTime: r.prepTime,
              cookTime: r.cookTime,
              tags: r.tags,
              requiredCookwareIds,
              source: 'ai-generated',
            },
            r.ingredients,
          );
        }),
      );
    },
  }),
);

// ── Mutations — Cookware ──────────────────────────────────────────────────────

builder.mutationField('addCookware', (t) =>
  t.field({
    type: CookwareType,
    args: {
      name: t.arg.string({ required: true }),
      brand: t.arg.string(),
      tags: t.arg.stringList(),
      notes: t.arg.string(),
      kitchenSlug: t.arg.string(),
    },
    resolve: async (_, args) => {
      const kitchenId = await resolveKitchenId(args.kitchenSlug);
      const [row] = await sql`
        INSERT INTO cookware (id, name, brand, tags, notes, kitchen_id)
        VALUES (${randomUUID()}, ${args.name}, ${args.brand ?? null}, ${JSON.stringify(args.tags ?? [])}, ${args.notes ?? null}, ${kitchenId})
        RETURNING *
      `;
      return row;
    },
  }),
);

builder.mutationField('updateCookware', (t) =>
  t.field({
    type: CookwareType,
    args: {
      id: t.arg.string({ required: true }),
      name: t.arg.string(),
      brand: t.arg.string(),
      tags: t.arg.stringList(),
      notes: t.arg.string(),
    },
    resolve: async (_, args) => {
      const [row] = await sql`
        UPDATE cookware SET
          name = COALESCE(${args.name ?? null}, name),
          brand = COALESCE(${args.brand ?? null}, brand),
          tags = COALESCE(${args.tags ? JSON.stringify(args.tags) : null}, tags),
          notes = COALESCE(${args.notes ?? null}, notes)
        WHERE id = ${args.id}
        RETURNING *
      `;
      return row;
    },
  }),
);

builder.mutationField('deleteCookware', (t) =>
  t.field({
    type: 'Boolean',
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      await sql`DELETE FROM cookware WHERE id = ${id}`;
      return true;
    },
  }),
);

// ── Mutations — Kitchen ───────────────────────────────────────────────────────

builder.mutationField('createKitchen', (t) =>
  t.field({
    type: KitchenType,
    args: {
      slug: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (_, { slug, name }) => {
      if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Slug must be lowercase letters, numbers, and hyphens only.');
      if (slug === 'home') throw new Error('"home" is a reserved slug.');
      const [row] = await sql`
        INSERT INTO kitchens (id, slug, name) VALUES (${randomUUID()}, ${slug}, ${name}) RETURNING *
      `;
      return row;
    },
  }),
);

builder.mutationField('updateKitchen', (t) =>
  t.field({
    type: KitchenType,
    args: {
      id: t.arg.string({ required: true }),
      name: t.arg.string({ required: true }),
    },
    resolve: async (_, { id, name }) => {
      const [row] = await sql`
        UPDATE kitchens SET name = ${name} WHERE id = ${id} AND slug != 'home' RETURNING *
      `;
      if (!row) throw new Error('Kitchen not found or cannot rename the home kitchen.');
      return row;
    },
  }),
);

builder.mutationField('deleteKitchen', (t) =>
  t.field({
    type: 'Boolean',
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      await sql`DELETE FROM kitchens WHERE id = ${id} AND slug != 'home'`;
      return true;
    },
  }),
);

// ── Mutations — Menu ─────────────────────────────────────────────────────────

builder.mutationField('createMenu', (t) =>
  t.field({
    type: MenuType,
    args: {
      title: t.arg.string({ required: true }),
      description: t.arg.string(),
      active: t.arg.boolean(),
      category: t.arg.string(),
      sourceUrl: t.arg.string(),
      kitchenSlug: t.arg.string(),
      recipes: t.arg({ type: [MenuRecipeInputType], required: true }),
    },
    resolve: async (_, { title, description, active, category, sourceUrl, kitchenSlug, recipes }) => {
      const kitchenId = await resolveKitchenId(kitchenSlug);
      const slug = await uniqueMenuSlug(title);
      const isActive = active ?? true;
      const [menu] = await sql`
        INSERT INTO menus (id, title, slug, description, active, category, source_url, kitchen_id)
        VALUES (${randomUUID()}, ${title}, ${slug}, ${description ?? null}, ${isActive ? 1 : 0}, ${category ?? null}, ${sourceUrl ?? null}, ${kitchenId})
        RETURNING *
      `;
      for (let i = 0; i < recipes.length; i++) {
        const r = recipes[i];
        await sql`INSERT INTO menu_recipes (id, menu_id, recipe_id, course, sort_order) VALUES (${randomUUID()}, ${menu.id}, ${r.recipeId}, ${r.course ?? null}, ${r.sortOrder ?? i})`;
      }
      return menu;
    },
  }),
);

builder.mutationField('updateMenu', (t) =>
  t.field({
    type: MenuType,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
      title: t.arg.string(),
      description: t.arg.string(),
      active: t.arg.boolean(),
      category: t.arg.string(),
      sourceUrl: t.arg.string(),
      recipes: t.arg({ type: [MenuRecipeInputType] }),
    },
    resolve: async (_, { id, title, description, active, category, sourceUrl, recipes }) => {
      const slug = title ? await uniqueMenuSlug(title, id) : undefined;
      const activeBit = active == null ? null : (active ? 1 : 0);
      const [updated] = await sql`UPDATE menus SET
        title = COALESCE(${title ?? null}, title),
        slug = COALESCE(${slug ?? null}, slug),
        description = COALESCE(${description ?? null}, description),
        active = COALESCE(${activeBit}, active),
        category = ${category !== undefined ? (category ?? null) : null},
        source_url = COALESCE(${sourceUrl ?? null}, source_url)
        WHERE id = ${id} RETURNING *`;
      if (!updated) return null;
      if (recipes) {
        await sql`DELETE FROM menu_recipes WHERE menu_id = ${id}`;
        for (let i = 0; i < recipes.length; i++) {
          const r = recipes[i];
          await sql`INSERT INTO menu_recipes (id, menu_id, recipe_id, course, sort_order) VALUES (${randomUUID()}, ${id}, ${r.recipeId}, ${r.course ?? null}, ${r.sortOrder ?? i})`;
        }
      }
      return updated;
    },
  }),
);

builder.mutationField('deleteMenu', (t) =>
  t.field({
    type: 'Boolean',
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      await sql`DELETE FROM menus WHERE id = ${id}`;
      return true;
    },
  }),
);

builder.mutationField('toggleRecipeInMenu', (t) =>
  t.field({
    type: MenuType,
    args: {
      menuId: t.arg.string({ required: true }),
      recipeId: t.arg.string({ required: true }),
      course: t.arg.string(),
    },
    resolve: async (_, { menuId, recipeId, course }) => {
      const [existing] = await sql<{ id: string }>`
        SELECT id FROM menu_recipes WHERE menu_id = ${menuId} AND recipe_id = ${recipeId}
      `;
      if (existing) {
        await sql`DELETE FROM menu_recipes WHERE id = ${existing.id}`;
      } else {
        await sql`
          INSERT INTO menu_recipes (id, menu_id, recipe_id, course, sort_order)
          VALUES (
            ${randomUUID()},
            ${menuId},
            ${recipeId},
            ${course ?? 'other'},
            COALESCE((SELECT MAX(sort_order) + 1 FROM menu_recipes WHERE menu_id = ${menuId}), 0)
          )
        `;
      }
      const [menu] = await sql`SELECT * FROM menus WHERE id = ${menuId}`;
      return menu;
    },
  }),
);

// ── Export ────────────────────────────────────────────────────────────────────

export { builder };
export const schema = builder.toSchema();
