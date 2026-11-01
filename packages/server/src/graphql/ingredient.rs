use async_graphql::{Context, InputObject, MaybeUndefined, Object, SimpleObject};
use rusqlite::{params, types::Value, Connection, ToSql};

use crate::db::{self, new_id, now_iso, Pool};
use crate::graphql::sql_helpers::{
    json_str_list, normalize_product_meta, resolve_kitchen_id,
};
use crate::models::{parse_json_strings, IngredientRow};
use crate::units::{convert, normalize_unit};

#[derive(SimpleObject, Clone)]
pub struct Ingredient {
    pub id: String,
    pub name: String,
    pub category: Option<String>,
    pub quantity: Option<f64>,
    pub unit: Option<String>,
    pub item_size: Option<f64>,
    pub item_size_unit: Option<String>,
    pub always_on_hand: bool,
    pub tags: Vec<String>,
    pub aliases: Vec<String>,
    pub barcode: Option<String>,
    /// Serialized JSON string of the ProductMeta payload. Clients parse client-side.
    pub product_meta: Option<String>,
    /// Explicit best-by date (ISO 8601), set by the user or an agent. Null = estimate from category.
    pub expires_at: Option<String>,
    /// When this stock last came in: set on add, on a quantity increase, on touch and on merge.
    /// Falls back to createdAt for rows written before the column existed.
    pub stocked_at: String,
    pub updated_at: String,
    pub created_at: String,
}

impl From<IngredientRow> for Ingredient {
    fn from(r: IngredientRow) -> Self {
        let stocked_at = r.stocked_at.clone().unwrap_or_else(|| r.created_at.clone());
        let updated_at = r.updated_at.clone().unwrap_or_else(|| r.created_at.clone());
        Ingredient {
            id: r.id,
            name: r.name,
            category: r.category,
            quantity: r.quantity,
            unit: r.unit,
            item_size: r.item_size,
            item_size_unit: r.item_size_unit,
            always_on_hand: r.always_on_hand,
            tags: parse_json_strings(r.tags_json.as_deref()),
            aliases: parse_json_strings(r.aliases_json.as_deref()),
            barcode: r.barcode,
            product_meta: r.product_meta,
            expires_at: r.expires_at,
            stocked_at,
            updated_at,
            created_at: r.created_at,
        }
    }
}

#[derive(InputObject, Clone)]
pub struct IngredientInput {
    pub name: String,
    pub category: Option<String>,
    pub quantity: Option<f64>,
    pub unit: Option<String>,
    pub item_size: Option<f64>,
    pub item_size_unit: Option<String>,
    pub always_on_hand: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub aliases: Option<Vec<String>>,
    pub barcode: Option<String>,
    pub product_meta: Option<String>,
    pub expires_at: Option<String>,
}

/// One row's patch for `updateIngredients`. Omitted fields are kept;
/// `expiresAt: null` clears the date.
#[derive(InputObject, Clone)]
pub struct IngredientPatchInput {
    pub id: String,
    pub name: Option<String>,
    pub category: Option<String>,
    /// Omit to keep, null to clear (back to "untracked"), a number to set.
    pub quantity: MaybeUndefined<f64>,
    /// Omit to keep, null to clear, a string to set.
    pub unit: MaybeUndefined<String>,
    pub item_size: Option<f64>,
    pub item_size_unit: Option<String>,
    pub always_on_hand: Option<bool>,
    pub tags: Option<Vec<String>>,
    pub aliases: Option<Vec<String>>,
    pub barcode: Option<String>,
    pub product_meta: Option<String>,
    /// Omit to keep, pass null to clear, or an ISO 8601 date to set.
    pub expires_at: MaybeUndefined<String>,
}

/// Result of `mergeIngredients`.
#[derive(SimpleObject)]
pub struct MergeIngredientsResult {
    pub ingredient: Ingredient,
    pub merged_ids: Vec<String>,
    /// Names of merged rows whose quantity could not be added to the survivor
    /// (incompatible units or item sizes).
    pub unmerged_quantities: Vec<String>,
}

/// One UPDATE behind both update mutations.
///
/// `keep_quantity`:
///   - false (updateIngredient): quantity and unit are written as given, so
///     omitting them clears them. The edit form always sends both.
///   - true (updateIngredients): omitted fields are left alone, so a bulk
///     patch that only sets expiresAt can't wipe quantities; an explicit
///     null clears quantity / unit (back to "untracked").
///
/// `expires_at`: omitted keeps, null clears, a string sets. `stocked_at`
/// moves to now only when the quantity goes up; `updated_at` always moves.
fn patch_ingredient(
    conn: &Connection,
    p: &IngredientPatchInput,
    keep_quantity: bool,
) -> rusqlite::Result<Ingredient> {
    let aoh_param: Option<i64> = p.always_on_hand.map(|b| if b { 1 } else { 0 });
    let aoh_is_true: i64 = if p.always_on_hand == Some(true) { 1 } else { 0 };
    let keep_qty: i64 = if keep_quantity && p.quantity.is_undefined() { 1 } else { 0 };
    let keep_unit: i64 = if keep_quantity && p.unit.is_undefined() { 1 } else { 0 };
    let quantity: Option<f64> = p.quantity.clone().take();
    let unit: Option<String> = p.unit.clone().take();
    let pm_json = p.product_meta.as_deref().and_then(|s| normalize_product_meta(Some(s)));
    let tags_text = p
        .tags
        .as_ref()
        .map(|t| serde_json::to_string(t).unwrap_or_else(|_| "[]".to_string()));
    let aliases_text = p
        .aliases
        .as_ref()
        .map(|a| serde_json::to_string(a).unwrap_or_else(|_| "[]".to_string()));
    let (keep_expires, expires_at): (i64, Option<String>) = match &p.expires_at {
        MaybeUndefined::Undefined => (1, None),
        MaybeUndefined::Null => (0, None),
        MaybeUndefined::Value(v) => (0, Some(v.clone())),
    };
    let now = now_iso();
    let changed = conn.execute(
        "UPDATE ingredients SET
            name = COALESCE(?1, name),
            category = COALESCE(?2, category),
            always_on_hand = COALESCE(?3, always_on_hand),
            quantity = CASE WHEN ?4 = 1 THEN NULL WHEN ?5 = 1 THEN quantity ELSE ?6 END,
            unit = CASE WHEN ?4 = 1 THEN NULL WHEN ?18 = 1 THEN unit ELSE ?7 END,
            item_size = COALESCE(?8, item_size),
            item_size_unit = COALESCE(?9, item_size_unit),
            tags = COALESCE(?10, tags),
            aliases = COALESCE(?11, aliases),
            barcode = COALESCE(?12, barcode),
            product_meta = COALESCE(?13, product_meta),
            expires_at = CASE WHEN ?14 = 1 THEN expires_at ELSE ?15 END,
            stocked_at = CASE WHEN ?6 IS NOT NULL AND ?6 > COALESCE(quantity, 0) THEN ?16 ELSE stocked_at END,
            updated_at = ?16
         WHERE id = ?17",
        params![
            p.name,
            p.category,
            aoh_param,
            aoh_is_true,
            keep_qty,
            quantity,
            unit,
            p.item_size,
            p.item_size_unit,
            tags_text,
            aliases_text,
            p.barcode,
            pm_json,
            keep_expires,
            expires_at,
            now,
            p.id,
            keep_unit,
        ],
    )?;
    if changed == 0 {
        return Err(rusqlite::Error::QueryReturnedNoRows);
    }
    let mut stmt = conn.prepare("SELECT * FROM ingredients WHERE id = ?1")?;
    let row = stmt.query_row(params![p.id], IngredientRow::from_row)?;
    Ok(Ingredient::from(row))
}

/// True when `arg` was bound to a variable the request did not supply.
///
/// Clients keep fixed operation strings that declare every variable
/// (`$expiresAt: String`) and leave the ones they don't use out of the
/// variables map. graphql-js treats that as "argument not provided", which
/// is what the TS resolvers see; async-graphql coerces it to null, which
/// `MaybeUndefined` can't tell apart from an explicit clear. This restores
/// the graphql-js reading so an omitted variable keeps the stored value.
fn arg_omitted_via_variable(ctx: &Context<'_>, arg: &str) -> bool {
    let Some(v) = ctx.item.node.get_argument(arg) else { return false };
    // `into_const_with` calls back once per variable the argument references;
    // the AST value type itself isn't re-exported, so this is how we read it.
    let mut missing = false;
    let _ = v.node.clone().into_const_with(|name| -> Result<async_graphql::Value, ()> {
        if !ctx.query_env.variables.contains_key(&name) {
            missing = true;
        }
        Ok(async_graphql::Value::Null)
    });
    missing
}

fn select_ingredients_in(conn: &Connection, ids: &[String]) -> rusqlite::Result<Vec<Ingredient>> {
    if ids.is_empty() {
        return Ok(vec![]);
    }
    let placeholders = std::iter::repeat("?")
        .take(ids.len())
        .collect::<Vec<_>>()
        .join(",");
    let sql = format!("SELECT * FROM ingredients WHERE id IN ({placeholders})");
    let mut stmt = conn.prepare(&sql)?;
    let params_dyn: Vec<&dyn ToSql> = ids.iter().map(|s| s as &dyn ToSql).collect();
    let rows = stmt
        .query_map(params_dyn.as_slice(), IngredientRow::from_row)?
        .collect::<rusqlite::Result<Vec<_>>>()?;
    // Preserve input order — the IN clause returns rows in storage order.
    let mut by_id: std::collections::HashMap<String, Ingredient> =
        rows.into_iter().map(|r| (r.id.clone(), r.into())).collect();
    Ok(ids.iter().filter_map(|id| by_id.remove(id)).collect())
}

#[derive(Default)]
pub struct IngredientQuery;

#[Object]
impl IngredientQuery {
    /// List pantry ingredients, optionally filtered by name (substring,
    /// case-insensitive), tags (must contain all), and kitchen.
    async fn ingredients(
        &self,
        ctx: &Context<'_>,
        name: Option<String>,
        tags: Option<Vec<String>>,
        kitchen_slug: Option<String>,
    ) -> async_graphql::Result<Vec<Ingredient>> {
        let pool = ctx.data::<Pool>()?;
        db::with_conn(pool, move |conn| {
            let kitchen_id = resolve_kitchen_id(conn, kitchen_slug.as_deref())?;
            let has_tags = tags.as_ref().map(|t| !t.is_empty()).unwrap_or(false);
            let has_name = name.as_ref().map(|n| !n.is_empty()).unwrap_or(false);

            // Tag containment (PG `tags @> ARRAY[...]`) → JSON1:
            // NOT EXISTS (any query tag missing from row tags).
            let mut sql = String::from(
                "SELECT * FROM ingredients WHERE kitchen_id = ?1",
            );
            let mut p: Vec<Value> = vec![Value::Text(kitchen_id)];
            if has_name {
                sql.push_str(" AND name LIKE ?");
                sql.push_str(&(p.len() + 1).to_string());
                sql.push_str(" COLLATE NOCASE");
                p.push(Value::Text(format!("%{}%", name.as_ref().unwrap())));
            }
            if has_tags {
                // serialize as a JSON array, then use json_each in subquery
                let tag_json = serde_json::to_string(tags.as_ref().unwrap()).unwrap();
                let idx = p.len() + 1;
                sql.push_str(&format!(
                    " AND NOT EXISTS (SELECT 1 FROM json_each(?{idx}) AS q WHERE q.value NOT IN (SELECT value FROM json_each(tags)))",
                ));
                p.push(Value::Text(tag_json));
            }
            sql.push_str(" ORDER BY name");

            let params_dyn: Vec<&dyn ToSql> = p.iter().map(|v| v as &dyn ToSql).collect();
            let mut stmt = conn.prepare(&sql)?;
            let rows = stmt
                .query_map(params_dyn.as_slice(), IngredientRow::from_row)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            Ok(rows.into_iter().map(Ingredient::from).collect())
        })
        .await
    }
}

#[derive(Default)]
pub struct IngredientMutation;

#[Object]
impl IngredientMutation {
    #[allow(clippy::too_many_arguments)]
    async fn add_ingredient(
        &self,
        ctx: &Context<'_>,
        name: String,
        category: Option<String>,
        quantity: Option<f64>,
        unit: Option<String>,
        item_size: Option<f64>,
        item_size_unit: Option<String>,
        always_on_hand: Option<bool>,
        tags: Option<Vec<String>>,
        aliases: Option<Vec<String>>,
        barcode: Option<String>,
        product_meta: Option<String>,
        expires_at: Option<String>,
        kitchen_slug: Option<String>,
    ) -> async_graphql::Result<Ingredient> {
        let pool = ctx.data::<Pool>()?;
        db::with_conn(pool, move |conn| {
            let kitchen_id = resolve_kitchen_id(conn, kitchen_slug.as_deref())?;
            let id = new_id();
            let pm_json = normalize_product_meta(product_meta.as_deref());
            let tags_text = json_str_list(tags.as_deref());
            let aliases_text = aliases
                .as_ref()
                .map(|a| serde_json::to_string(a).unwrap_or_else(|_| "[]".to_string()));
            conn.execute(
                "INSERT INTO ingredients
                   (id, name, category, quantity, unit, item_size, item_size_unit,
                    always_on_hand, tags, aliases, barcode, product_meta, expires_at, stocked_at, kitchen_id)
                 VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
                params![
                    id,
                    name,
                    category,
                    quantity,
                    unit,
                    item_size,
                    item_size_unit,
                    if always_on_hand.unwrap_or(false) { 1i64 } else { 0i64 },
                    tags_text,
                    aliases_text,
                    barcode,
                    pm_json,
                    expires_at,
                    now_iso(),
                    kitchen_id,
                ],
            )?;
            let mut stmt = conn.prepare("SELECT * FROM ingredients WHERE id = ?1")?;
            let row = stmt.query_row(params![id], IngredientRow::from_row)?;
            Ok(Ingredient::from(row))
        })
        .await
    }

    async fn add_ingredients(
        &self,
        ctx: &Context<'_>,
        inputs: Vec<IngredientInput>,
        kitchen_slug: Option<String>,
    ) -> async_graphql::Result<Vec<Ingredient>> {
        if inputs.is_empty() {
            return Ok(vec![]);
        }
        let pool = ctx.data::<Pool>()?;
        db::with_conn(pool, move |conn| {
            let kitchen_id = resolve_kitchen_id(conn, kitchen_slug.as_deref())?;
            let tx = conn.transaction()?;
            let mut ids: Vec<String> = Vec::with_capacity(inputs.len());
            {
                let mut stmt = tx.prepare(
                    "INSERT INTO ingredients
                       (id, name, category, quantity, unit, item_size, item_size_unit,
                        always_on_hand, tags, aliases, barcode, product_meta, expires_at, stocked_at, kitchen_id)
                     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12,?13,?14,?15)",
                )?;
                let now = now_iso();
                for i in &inputs {
                    let id = new_id();
                    let pm_json = normalize_product_meta(i.product_meta.as_deref());
                    let tags_text = json_str_list(i.tags.as_deref());
                    let aliases_text = i
                        .aliases
                        .as_ref()
                        .map(|a| serde_json::to_string(a).unwrap_or_else(|_| "[]".to_string()));
                    stmt.execute(params![
                        id,
                        i.name,
                        i.category,
                        i.quantity,
                        i.unit,
                        i.item_size,
                        i.item_size_unit,
                        if i.always_on_hand.unwrap_or(false) { 1i64 } else { 0i64 },
                        tags_text,
                        aliases_text,
                        i.barcode,
                        pm_json,
                        i.expires_at,
                        now,
                        kitchen_id,
                    ])?;
                    ids.push(id);
                }
            }
            tx.commit()?;
            let placeholders = std::iter::repeat("?")
                .take(ids.len())
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!("SELECT * FROM ingredients WHERE id IN ({placeholders})");
            let mut stmt = conn.prepare(&sql)?;
            let params_dyn: Vec<&dyn ToSql> = ids.iter().map(|s| s as &dyn ToSql).collect();
            let rows = stmt
                .query_map(params_dyn.as_slice(), IngredientRow::from_row)?
                .collect::<rusqlite::Result<Vec<_>>>()?;
            // Preserve insert order — the IN clause returns rows in storage order.
            let mut by_id: std::collections::HashMap<String, Ingredient> =
                rows.into_iter().map(|r| (r.id.clone(), r.into())).collect();
            let ordered: Vec<Ingredient> = ids.into_iter().filter_map(|id| by_id.remove(&id)).collect();
            Ok(ordered)
        })
        .await
    }

    #[allow(clippy::too_many_arguments)]
    async fn update_ingredient(
        &self,
        ctx: &Context<'_>,
        id: String,
        name: Option<String>,
        category: Option<String>,
        quantity: Option<f64>,
        unit: Option<String>,
        item_size: Option<f64>,
        item_size_unit: Option<String>,
        always_on_hand: Option<bool>,
        tags: Option<Vec<String>>,
        aliases: Option<Vec<String>>,
        barcode: Option<String>,
        product_meta: Option<String>,
        #[graphql(desc = "Omit to keep, pass null to clear, or an ISO 8601 date to set.")]
        expires_at: MaybeUndefined<String>,
    ) -> async_graphql::Result<Ingredient> {
        let pool = ctx.data::<Pool>()?;
        let expires_at = if arg_omitted_via_variable(ctx, "expiresAt") {
            MaybeUndefined::Undefined
        } else {
            expires_at
        };
        let patch = IngredientPatchInput {
            id,
            name,
            category,
            // Replace semantics: an omitted quantity/unit clears it, so an
            // absent arg maps to Null, not Undefined.
            quantity: quantity.map_or(MaybeUndefined::Null, MaybeUndefined::Value),
            unit: unit.map_or(MaybeUndefined::Null, MaybeUndefined::Value),
            item_size,
            item_size_unit,
            always_on_hand,
            tags,
            aliases,
            barcode,
            product_meta,
            expires_at,
        };
        db::with_conn(pool, move |conn| patch_ingredient(conn, &patch, false)).await
    }

    /// Patch many pantry rows in one transaction. Omitted fields are kept;
    /// an explicit null clears `quantity`, `unit` or `expiresAt`. Returns
    /// rows in input order.
    async fn update_ingredients(
        &self,
        ctx: &Context<'_>,
        inputs: Vec<IngredientPatchInput>,
    ) -> async_graphql::Result<Vec<Ingredient>> {
        if inputs.is_empty() {
            return Ok(vec![]);
        }
        let pool = ctx.data::<Pool>()?;
        db::with_conn(pool, move |conn| {
            let tx = conn.transaction()?;
            let mut out = Vec::with_capacity(inputs.len());
            for p in &inputs {
                out.push(patch_ingredient(&tx, p, true)?);
            }
            tx.commit()?;
            Ok(out)
        })
        .await
        .map_err(|e| {
            if e.message.contains("Query returned no rows") {
                async_graphql::Error::new("Ingredient not found")
            } else {
                e
            }
        })
    }

    /// Delete many pantry rows at once. Returns how many were deleted.
    async fn delete_ingredients(
        &self,
        ctx: &Context<'_>,
        ids: Vec<String>,
    ) -> async_graphql::Result<i32> {
        if ids.is_empty() {
            return Ok(0);
        }
        let pool = ctx.data::<Pool>()?;
        db::with_conn(pool, move |conn| {
            let placeholders = std::iter::repeat("?")
                .take(ids.len())
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!("DELETE FROM ingredients WHERE id IN ({placeholders})");
            let params_dyn: Vec<&dyn ToSql> = ids.iter().map(|s| s as &dyn ToSql).collect();
            let n = conn.execute(&sql, params_dyn.as_slice())?;
            Ok(n as i32)
        })
        .await
    }

    /// "Still have it": marks rows as freshly stocked (stockedAt and
    /// updatedAt = now) without changing quantities.
    async fn touch_ingredients(
        &self,
        ctx: &Context<'_>,
        ids: Vec<String>,
    ) -> async_graphql::Result<Vec<Ingredient>> {
        if ids.is_empty() {
            return Ok(vec![]);
        }
        let pool = ctx.data::<Pool>()?;
        db::with_conn(pool, move |conn| {
            let now = now_iso();
            let placeholders = (0..ids.len())
                .map(|i| format!("?{}", i + 2))
                .collect::<Vec<_>>()
                .join(",");
            let sql = format!(
                "UPDATE ingredients SET stocked_at = ?1, updated_at = ?1 WHERE id IN ({placeholders})"
            );
            let mut p: Vec<&dyn ToSql> = vec![&now];
            p.extend(ids.iter().map(|s| s as &dyn ToSql));
            conn.execute(&sql, p.as_slice())?;
            select_ingredients_in(conn, &ids)
        })
        .await
    }

    /// Merge duplicate pantry rows into a survivor. Quantities are summed
    /// when units and item sizes are compatible, tags and aliases are
    /// unioned, the merged names become aliases of the survivor, the
    /// earliest expiry and the latest stockedAt win, and the merged rows are
    /// deleted.
    async fn merge_ingredients(
        &self,
        ctx: &Context<'_>,
        survivor_id: String,
        merge_ids: Vec<String>,
    ) -> async_graphql::Result<MergeIngredientsResult> {
        let pool = ctx.data::<Pool>()?;
        db::with_conn(pool, move |conn| {
            let survivor = conn
                .prepare("SELECT * FROM ingredients WHERE id = ?1")?
                .query_row(params![survivor_id], IngredientRow::from_row)?;
            let mut ids: Vec<String> = Vec::new();
            for id in merge_ids {
                if id != survivor_id && !ids.contains(&id) {
                    ids.push(id);
                }
            }
            let others: Vec<IngredientRow> = if ids.is_empty() {
                vec![]
            } else {
                let placeholders = (0..ids.len())
                    .map(|i| format!("?{}", i + 2))
                    .collect::<Vec<_>>()
                    .join(",");
                let sql = format!(
                    "SELECT * FROM ingredients WHERE kitchen_id = ?1 AND id IN ({placeholders})"
                );
                let mut p: Vec<&dyn ToSql> = vec![&survivor.kitchen_id];
                p.extend(ids.iter().map(|s| s as &dyn ToSql));
                let mut stmt = conn.prepare(&sql)?;
                let rows = stmt
                    .query_map(p.as_slice(), IngredientRow::from_row)?
                    .collect::<rusqlite::Result<Vec<_>>>()?;
                rows
            };
            if others.is_empty() {
                return Ok(MergeIngredientsResult {
                    ingredient: Ingredient::from(survivor),
                    merged_ids: vec![],
                    unmerged_quantities: vec![],
                });
            }

            let mut quantity = survivor.quantity;
            let mut unmerged: Vec<String> = Vec::new();
            let mut tags = parse_json_strings(survivor.tags_json.as_deref());
            let mut aliases = parse_json_strings(survivor.aliases_json.as_deref());
            let mut seen_tags: Vec<String> = tags.iter().map(|t| t.to_lowercase()).collect();
            let mut seen_aliases: Vec<String> = std::iter::once(survivor.name.to_lowercase())
                .chain(aliases.iter().map(|a| a.to_lowercase()))
                .collect();
            let mut barcode = survivor.barcode.clone();
            let mut product_meta = survivor.product_meta.clone();
            let mut category = survivor.category.clone();
            let mut expires_at = survivor.expires_at.clone();
            let mut stocked_at = survivor
                .stocked_at
                .clone()
                .unwrap_or_else(|| survivor.created_at.clone());

            for o in &others {
                if !survivor.always_on_hand {
                    if let Some(oq) = o.quantity {
                        let same_size = survivor.item_size == o.item_size
                            && normalize_unit(survivor.item_size_unit.as_deref())
                                == normalize_unit(o.item_size_unit.as_deref());
                        let add = if survivor.unit.is_none() && o.unit.is_none() {
                            Some(oq)
                        } else {
                            convert(oq, o.unit.as_deref(), survivor.unit.as_deref())
                        };
                        match add {
                            Some(a) if same_size => quantity = Some(quantity.unwrap_or(0.0) + a),
                            _ => unmerged.push(o.name.clone()),
                        }
                    }
                }
                for tag in parse_json_strings(o.tags_json.as_deref()) {
                    let l = tag.to_lowercase();
                    if !seen_tags.contains(&l) {
                        seen_tags.push(l);
                        tags.push(tag);
                    }
                }
                for alias in std::iter::once(o.name.clone())
                    .chain(parse_json_strings(o.aliases_json.as_deref()))
                {
                    let l = alias.to_lowercase();
                    if !seen_aliases.contains(&l) {
                        seen_aliases.push(l);
                        aliases.push(alias);
                    }
                }
                if barcode.is_none() {
                    barcode = o.barcode.clone();
                }
                if product_meta.is_none() {
                    product_meta = o.product_meta.clone();
                }
                if category.is_none() {
                    category = o.category.clone();
                }
                if let Some(oe) = &o.expires_at {
                    if expires_at.as_ref().map(|e| oe < e).unwrap_or(true) {
                        expires_at = Some(oe.clone());
                    }
                }
                let o_stocked = o.stocked_at.clone().unwrap_or_else(|| o.created_at.clone());
                if o_stocked > stocked_at {
                    stocked_at = o_stocked;
                }
            }

            let now = now_iso();
            let merged_ids: Vec<String> = others.iter().map(|o| o.id.clone()).collect();
            let tx = conn.transaction()?;
            tx.execute(
                "UPDATE ingredients SET
                    quantity = ?1, category = ?2, tags = ?3, aliases = ?4, barcode = ?5,
                    product_meta = ?6, expires_at = ?7, stocked_at = ?8, updated_at = ?9
                 WHERE id = ?10",
                params![
                    quantity,
                    category,
                    serde_json::to_string(&tags).unwrap_or_else(|_| "[]".to_string()),
                    serde_json::to_string(&aliases).unwrap_or_else(|_| "[]".to_string()),
                    barcode,
                    product_meta,
                    expires_at,
                    stocked_at,
                    now,
                    survivor_id,
                ],
            )?;
            {
                let placeholders = std::iter::repeat("?")
                    .take(merged_ids.len())
                    .collect::<Vec<_>>()
                    .join(",");
                let sql = format!("DELETE FROM ingredients WHERE id IN ({placeholders})");
                let p: Vec<&dyn ToSql> = merged_ids.iter().map(|s| s as &dyn ToSql).collect();
                tx.execute(&sql, p.as_slice())?;
            }
            tx.commit()?;

            let row = conn
                .prepare("SELECT * FROM ingredients WHERE id = ?1")?
                .query_row(params![survivor_id], IngredientRow::from_row)?;
            Ok(MergeIngredientsResult {
                ingredient: Ingredient::from(row),
                merged_ids,
                unmerged_quantities: unmerged,
            })
        })
        .await
        .map_err(|e| {
            if e.message.contains("Query returned no rows") {
                async_graphql::Error::new("Ingredient not found")
            } else {
                e
            }
        })
    }

    async fn delete_ingredient(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> async_graphql::Result<bool> {
        let pool = ctx.data::<Pool>()?;
        db::with_conn(pool, move |conn| {
            conn.execute("DELETE FROM ingredients WHERE id = ?1", params![id])?;
            Ok(true)
        })
        .await
    }
}
