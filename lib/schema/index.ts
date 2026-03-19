import SchemaBuilder from '@pothos/core';
import sql from '@/lib/db';
import { generateRecipes as aiGenerateRecipes } from '@/lib/claude';

const builder = new SchemaBuilder({});

builder.queryType({});
builder.mutationType({});

// ── Kitchen ───────────────────────────────────────────────────────────────────

const KitchenType = builder.objectType('Kitchen', {
  fields: (t) => ({
    id: t.exposeString('id'),
    slug: t.exposeString('slug'),
    name: t.exposeString('name'),
    createdAt: t.string({ resolve: (r) => r.created_at?.toISOString() ?? '' }),
  }),
});

async function resolveKitchenId(slug: string | null | undefined): Promise<string> {
  const s = slug ?? 'home';
  const [kitchen] = await sql`SELECT id FROM kitchens WHERE slug = ${s}`;
  if (!kitchen) throw new Error(`Kitchen not found: ${s}`);
  return kitchen.id;
}

// ── Ingredient ────────────────────────────────────────────────────────────────

const IngredientType = builder.objectType('Ingredient', {
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    category: t.string({ nullable: true, resolve: (r) => r.category }),
    quantity: t.float({ nullable: true, resolve: (r) => r.quantity }),
    unit: t.string({ nullable: true, resolve: (r) => r.unit }),
    alwaysOnHand: t.boolean({ resolve: (r) => r.always_on_hand ?? false }),
    tags: t.stringList({ resolve: (r) => r.tags ?? [] }),
    createdAt: t.string({ resolve: (r) => r.created_at?.toISOString() ?? '' }),
  }),
});

const IngredientInputType = builder.inputType('IngredientInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    category: t.string(),
    quantity: t.float(),
    unit: t.string(),
    alwaysOnHand: t.boolean(),
    tags: t.stringList(),
  }),
});

// ── Recipe ────────────────────────────────────────────────────────────────────

const RecipeIngredientType = builder.objectType('RecipeIngredient', {
  fields: (t) => ({
    ingredientName: t.string({ resolve: (r) => r.ingredient_name }),
    quantity: t.float({ nullable: true, resolve: (r) => r.quantity }),
    unit: t.string({ nullable: true, resolve: (r) => r.unit }),
    sourceRecipeId: t.string({ nullable: true, resolve: (r) => r.source_recipe_id ?? null }),
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
      ? await sql`SELECT id FROM recipes WHERE slug = ${candidate} AND id != ${excludeId}`
      : await sql`SELECT id FROM recipes WHERE slug = ${candidate}`;
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
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
    tags: t.stringList({ resolve: (r) => r.tags ?? [] }),
    requiredCookware: t.stringList({ resolve: (r) => r.required_cookware ?? [] }),
    source: t.exposeString('source'),
    sourceUrl: t.string({ nullable: true, resolve: (r) => r.source_url ?? null }),
    photoUrl: t.string({ nullable: true, resolve: (r) => r.photo_url }),
    lastMadeAt: t.string({ nullable: true, resolve: (r) => r.last_made_at?.toISOString() ?? null }),
    queued: t.boolean({ resolve: (r) => r.queued ?? false }),
    ingredients: t.field({
      type: [RecipeIngredientType],
      resolve: async (recipe) => {
        return sql`SELECT * FROM recipe_ingredients WHERE recipe_id = ${recipe.id} ORDER BY sort_order, id`;
      },
    }),
    createdAt: t.string({ resolve: (r) => r.created_at?.toISOString() ?? '' }),
    usedIn: t.field({
      type: [RecipeType],
      resolve: async (recipe) =>
        sql`SELECT DISTINCT r.* FROM recipes r JOIN recipe_ingredients ri ON ri.recipe_id = r.id WHERE ri.source_recipe_id = ${recipe.id} ORDER BY r.title`,
    }),
  }),
});

const RecipeIngredientInputType = builder.inputType('RecipeIngredientInput', {
  fields: (t) => ({
    ingredientName: t.string({ required: true }),
    quantity: t.float(),
    unit: t.string(),
    sourceRecipeId: t.string(),
  }),
});

// ── Cookware ──────────────────────────────────────────────────────────────────

const CookwareType = builder.objectType('Cookware', {
  fields: (t) => ({
    id: t.exposeString('id'),
    name: t.exposeString('name'),
    brand: t.string({ nullable: true, resolve: (r) => r.brand }),
    tags: t.stringList({ resolve: (r) => r.tags ?? [] }),
    createdAt: t.string({ resolve: (r) => r.created_at?.toISOString() ?? '' }),
    recipes: t.field({
      type: [RecipeType],
      resolve: async (cookware) =>
        sql`SELECT * FROM recipes WHERE required_cookware @> ARRAY[${cookware.name}] ORDER BY title`,
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
    active: t.boolean({ resolve: (r) => r.active ?? true }),
    createdAt: t.string({ resolve: (r) => r.created_at?.toISOString() ?? '' }),
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
      ? await sql`SELECT id FROM menus WHERE slug = ${candidate} AND id != ${excludeId}`
      : await sql`SELECT id FROM menus WHERE slug = ${candidate}`;
    if (!existing) return candidate;
    candidate = `${base}-${suffix++}`;
  }
}

// ── Queries ───────────────────────────────────────────────────────────────────

builder.queryField('ingredients', (t) =>
  t.field({
    type: [IngredientType],
    args: { tags: t.arg.stringList(), kitchenSlug: t.arg.string() },
    resolve: async (_, { tags, kitchenSlug }) => {
      const kitchenId = await resolveKitchenId(kitchenSlug);
      if (tags && tags.length > 0) {
        return sql`SELECT * FROM ingredients WHERE kitchen_id = ${kitchenId} AND tags @> ${sql.array(tags)} ORDER BY name`;
      }
      return sql`SELECT * FROM ingredients WHERE kitchen_id = ${kitchenId} ORDER BY name`;
    },
  }),
);

builder.queryField('recipes', (t) =>
  t.field({
    type: [RecipeType],
    args: { tags: t.arg.stringList(), cookware: t.arg.stringList(), queued: t.arg.boolean(), kitchenSlug: t.arg.string() },
    resolve: async (_, { tags, cookware, queued, kitchenSlug }) => {
      const kitchenId = await resolveKitchenId(kitchenSlug);
      if (tags?.length && cookware?.length) {
        return sql`SELECT * FROM recipes WHERE kitchen_id = ${kitchenId} AND tags && ${sql.array(tags)} AND required_cookware && ${sql.array(cookware)} ORDER BY created_at DESC`;
      }
      if (tags?.length) {
        return sql`SELECT * FROM recipes WHERE kitchen_id = ${kitchenId} AND tags && ${sql.array(tags)} ORDER BY created_at DESC`;
      }
      if (cookware?.length) {
        return sql`SELECT * FROM recipes WHERE kitchen_id = ${kitchenId} AND required_cookware && ${sql.array(cookware)} ORDER BY created_at DESC`;
      }
      if (queued != null) {
        return sql`SELECT * FROM recipes WHERE kitchen_id = ${kitchenId} AND queued = ${queued} ORDER BY created_at DESC`;
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
      const [row] = await sql`SELECT * FROM recipes WHERE slug = ${id} OR id::text = ${id}`;
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
      const [row] = await sql`SELECT * FROM menus WHERE slug = ${id} OR id::text = ${id}`;
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
      alwaysOnHand: t.arg.boolean(),
      tags: t.arg.stringList(),
      kitchenSlug: t.arg.string(),
    },
    resolve: async (_, args) => {
      const kitchenId = await resolveKitchenId(args.kitchenSlug);
      const [row] = await sql`
        INSERT INTO ingredients (name, category, quantity, unit, always_on_hand, tags, kitchen_id)
        VALUES (
          ${args.name},
          ${args.category ?? null},
          ${args.quantity ?? null},
          ${args.unit ?? null},
          ${args.alwaysOnHand ?? false},
          ${sql.array(args.tags ?? [])},
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
      const rows = await sql`
        INSERT INTO ingredients ${sql(
          inputs.map((i) => ({
            name: i.name,
            category: i.category ?? null,
            quantity: i.quantity ?? null,
            unit: i.unit ?? null,
            always_on_hand: i.alwaysOnHand ?? false,
            tags: i.tags ?? [],
            kitchen_id: kitchenId,
          })),
          'name', 'category', 'quantity', 'unit', 'always_on_hand', 'tags', 'kitchen_id',
        )}
        RETURNING *
      `;
      return rows;
    },
  }),
);

builder.mutationField('updateIngredient', (t) =>
  t.field({
    type: IngredientType,
    args: {
      id: t.arg.string({ required: true }),
      name: t.arg.string(),
      category: t.arg.string(),
      quantity: t.arg.float(),
      unit: t.arg.string(),
      alwaysOnHand: t.arg.boolean(),
      tags: t.arg.stringList(),
    },
    resolve: async (_, args) => {
      const [row] = await sql`
        UPDATE ingredients SET
          name = COALESCE(${args.name ?? null}, name),
          category = COALESCE(${args.category ?? null}, category),
          always_on_hand = COALESCE(${args.alwaysOnHand ?? null}, always_on_hand),
          quantity = CASE WHEN ${args.alwaysOnHand ?? null} = true THEN NULL ELSE ${args.quantity ?? null}::numeric END,
          unit = CASE WHEN ${args.alwaysOnHand ?? null} = true THEN NULL ELSE ${args.unit ?? null}::text END,
          tags = COALESCE(${args.tags ? sql.array(args.tags) : null}, tags),
          updated_at = NOW()
        WHERE id = ${args.id}
        RETURNING *
      `;
      return row;
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
    requiredCookware?: string[] | null;
    source?: string;
    sourceUrl?: string | null;
    photoUrl?: string | null;
    kitchenId?: string;
  },
  ingredients: { ingredientName: string; quantity?: number | null; unit?: string | null; sourceRecipeId?: string | null }[],
) {
  const kitchenId = data.kitchenId ?? await resolveKitchenId('home');
  const slug = await uniqueSlug(data.title);
  const [recipe] = await sql`
    INSERT INTO recipes (title, slug, description, instructions, servings, prep_time, cook_time, tags, required_cookware, source, source_url, photo_url, kitchen_id)
    VALUES (
      ${data.title},
      ${slug},
      ${data.description ?? null},
      ${data.instructions},
      ${data.servings ?? 2},
      ${data.prepTime ?? null},
      ${data.cookTime ?? null},
      ${sql.array(data.tags ?? [])},
      ${sql.array(data.requiredCookware ?? [])},
      ${data.source ?? 'manual'},
      ${data.sourceUrl ?? null},
      ${data.photoUrl ?? null},
      ${kitchenId}
    )
    RETURNING *
  `;

  if (ingredients.length > 0) {
    await sql`
      INSERT INTO recipe_ingredients ${sql(
        ingredients.map((i, idx) => ({
          recipe_id: recipe.id,
          ingredient_name: i.ingredientName,
          quantity: i.quantity ?? null,
          unit: i.unit ?? null,
          source_recipe_id: i.sourceRecipeId ?? null,
          sort_order: idx,
        })),
        'recipe_id', 'ingredient_name', 'quantity', 'unit', 'source_recipe_id', 'sort_order',
      )}
    `;
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
      requiredCookware: t.arg.stringList(),
      photoUrl: t.arg.string(),
      sourceUrl: t.arg.string(),
      ingredients: t.arg({ type: [RecipeIngredientInputType], required: true }),
      kitchenSlug: t.arg.string(),
    },
    resolve: async (_, args) => {
      const kitchenId = await resolveKitchenId(args.kitchenSlug);
      return insertRecipe(
        {
          title: args.title,
          description: args.description,
          instructions: args.instructions,
          servings: args.servings,
          prepTime: args.prepTime,
          cookTime: args.cookTime,
          tags: args.tags,
          requiredCookware: args.requiredCookware,
          photoUrl: args.photoUrl,
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
      requiredCookware: t.arg.stringList(),
      photoUrl: t.arg.string(),
      ingredients: t.arg({ type: [RecipeIngredientInputType] }),
    },
    resolve: async (_, args) => {
      const newSlug = args.title ? await uniqueSlug(args.title, args.id) : null;
      const [recipe] = await sql`
        UPDATE recipes SET
          title = COALESCE(${args.title ?? null}, title),
          slug  = COALESCE(${newSlug}, slug),
          description = COALESCE(${args.description ?? null}, description),
          instructions = COALESCE(${args.instructions ?? null}, instructions),
          servings = COALESCE(${args.servings ?? null}, servings),
          prep_time = COALESCE(${args.prepTime ?? null}, prep_time),
          cook_time = COALESCE(${args.cookTime ?? null}, cook_time),
          tags = COALESCE(${args.tags ? sql.array(args.tags) : null}, tags),
          required_cookware = COALESCE(${args.requiredCookware ? sql.array(args.requiredCookware) : null}, required_cookware),
          photo_url = COALESCE(${args.photoUrl ?? null}, photo_url)
        WHERE id = ${args.id}
        RETURNING *
      `;

      if (args.ingredients) {
        await sql`DELETE FROM recipe_ingredients WHERE recipe_id = ${args.id}`;
        if (args.ingredients.length > 0) {
          await sql`
            INSERT INTO recipe_ingredients ${sql(
              args.ingredients.map((i, idx) => ({
                recipe_id: args.id,
                ingredient_name: i.ingredientName,
                quantity: i.quantity ?? null,
                unit: i.unit ?? null,
                sort_order: idx,
              })),
              'recipe_id', 'ingredient_name', 'quantity', 'unit', 'sort_order',
            )}
          `;
        }
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
    args: {
      id: t.arg.string({ required: true }),
      servings: t.arg.int(),
    },
    resolve: async (_, { id }) => {
      const [updated] = await sql`UPDATE recipes SET last_made_at = NOW() WHERE id = ${id} RETURNING *`;
      if (!updated) throw new Error('Recipe not found');
      return updated;
    },
  }),
);

builder.mutationField('toggleRecipeQueued', (t) =>
  t.field({
    type: RecipeType,
    args: { id: t.arg.string({ required: true }) },
    resolve: async (_, { id }) => {
      const [updated] = await sql`UPDATE recipes SET queued = NOT queued WHERE id = ${id} RETURNING *`;
      if (!updated) throw new Error('Recipe not found');
      return updated;
    },
  }),
);

builder.mutationField('generateRecipes', (t) =>
  t.field({
    type: [RecipeType],
    resolve: async () => {
      const ingredients = await sql`SELECT * FROM ingredients ORDER BY name`;
      const cookware = await sql`SELECT * FROM cookware ORDER BY name`;
      const generated = await aiGenerateRecipes(ingredients, cookware);
      return Promise.all(
        generated.map((r) =>
          insertRecipe(
            {
              title: r.title,
              description: r.description,
              instructions: r.instructions,
              servings: r.servings ?? 2,
              prepTime: r.prepTime,
              cookTime: r.cookTime,
              tags: r.tags,
              requiredCookware: r.requiredCookware,
              source: 'ai-generated',
            },
            r.ingredients,
          ),
        ),
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
      kitchenSlug: t.arg.string(),
    },
    resolve: async (_, args) => {
      const kitchenId = await resolveKitchenId(args.kitchenSlug);
      const [row] = await sql`
        INSERT INTO cookware (name, brand, tags, kitchen_id)
        VALUES (${args.name}, ${args.brand ?? null}, ${sql.array(args.tags ?? [])}, ${kitchenId})
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
    },
    resolve: async (_, args) => {
      const [row] = await sql`
        UPDATE cookware SET
          name = COALESCE(${args.name ?? null}, name),
          brand = COALESCE(${args.brand ?? null}, brand),
          tags = COALESCE(${args.tags ? sql.array(args.tags) : null}, tags)
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
        INSERT INTO kitchens (slug, name) VALUES (${slug}, ${name}) RETURNING *
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
      kitchenSlug: t.arg.string(),
      recipes: t.arg({ type: [MenuRecipeInputType], required: true }),
    },
    resolve: async (_, { title, description, active, kitchenSlug, recipes }) => {
      const kitchenId = await resolveKitchenId(kitchenSlug);
      const slug = await uniqueMenuSlug(title);
      const isActive = active ?? true;
      const [menu] = await sql`INSERT INTO menus (title, slug, description, active, kitchen_id) VALUES (${title}, ${slug}, ${description ?? null}, ${isActive}, ${kitchenId}) RETURNING *`;
      for (let i = 0; i < recipes.length; i++) {
        const r = recipes[i];
        await sql`INSERT INTO menu_recipes (menu_id, recipe_id, course, sort_order) VALUES (${menu.id}, ${r.recipeId}, ${r.course ?? null}, ${r.sortOrder ?? i})`;
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
      recipes: t.arg({ type: [MenuRecipeInputType] }),
    },
    resolve: async (_, { id, title, description, active, recipes }) => {
      const slug = title ? await uniqueMenuSlug(title, id) : undefined;
      const [updated] = await sql`UPDATE menus SET
        title = COALESCE(${title ?? null}, title),
        slug = COALESCE(${slug ?? null}, slug),
        description = COALESCE(${description ?? null}, description),
        active = COALESCE(${active ?? null}, active)
        WHERE id = ${id} RETURNING *`;
      if (!updated) return null;
      if (recipes) {
        await sql`DELETE FROM menu_recipes WHERE menu_id = ${id}`;
        for (let i = 0; i < recipes.length; i++) {
          const r = recipes[i];
          await sql`INSERT INTO menu_recipes (menu_id, recipe_id, course, sort_order) VALUES (${id}, ${r.recipeId}, ${r.course ?? null}, ${r.sortOrder ?? i})`;
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

// ── Export ────────────────────────────────────────────────────────────────────

export { builder };
export const schema = builder.toSchema();
