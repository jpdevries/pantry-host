//! Plan the pantry decrement for cooking a recipe.
//!
//! Port of `packages/shared/src/pantry-decrement.ts` (and the matching tiers
//! of `grocery-status.ts` it relies on). Pure: takes the recipe lines and the
//! kitchen's pantry, returns one `PantryChange` per line. `cook_recipe` in
//! `graphql/recipe.rs` applies the `decremented` rows unless `dry_run`.
//!
//! Matching is the grocery list's: exact lowercase name → normalized name
//! (prep notes and parentheticals stripped) → whole-word suffix against short
//! pantry names, with aliases indexed under the same row. Quantities go
//! through the two-dimension total model: "3 jars × 12 fl oz" is 36 fl oz.

use std::collections::HashMap;

use async_graphql::SimpleObject;

use crate::units::{convert, normalize_unit};

#[derive(Debug, Clone)]
pub struct PantryRow {
    pub id: String,
    pub name: String,
    pub aliases: Vec<String>,
    pub quantity: Option<f64>,
    pub unit: Option<String>,
    pub item_size: Option<f64>,
    pub item_size_unit: Option<String>,
    pub always_on_hand: bool,
}

#[derive(Debug, Clone)]
pub struct RecipeLine {
    pub ingredient_name: String,
    pub quantity: Option<f64>,
    pub unit: Option<String>,
    pub item_size: Option<f64>,
    pub item_size_unit: Option<String>,
}

/// What cooking did (or would do) to one pantry row. `status` is one of
/// `decremented | unmatched | always_on_hand | untracked | no_quantity |
/// unconvertible`; `before` and `after` are in the pantry row's own unit.
#[derive(SimpleObject, Debug, Clone)]
pub struct PantryChange {
    pub recipe_ingredient: String,
    pub ingredient_id: Option<String>,
    pub pantry_name: Option<String>,
    pub before: Option<f64>,
    pub after: Option<f64>,
    pub unit: Option<String>,
    pub status: String,
}

/// Strip parentheticals, drop anything after the first comma, trim,
/// lowercase, collapse whitespace. Mirrors `normalizeIngredientName`.
pub fn normalize_ingredient_name(name: &str) -> String {
    let mut stripped = String::with_capacity(name.len());
    let mut depth = 0usize;
    for ch in name.chars() {
        match ch {
            '(' => {
                depth += 1;
                stripped.push(' ');
            }
            ')' => {
                depth = depth.saturating_sub(1);
            }
            _ if depth == 0 => stripped.push(ch),
            _ => {}
        }
    }
    let first = stripped.split(',').next().unwrap_or("");
    first
        .trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

struct PantryIndex {
    exact: HashMap<String, usize>,
    normalized: HashMap<String, usize>,
    /// (normalized key, row index), longest key first.
    suffix: Vec<(String, usize)>,
}

fn build_index(pantry: &[PantryRow]) -> PantryIndex {
    let mut exact = HashMap::new();
    let mut normalized = HashMap::new();
    let mut suffix: Vec<(String, usize)> = Vec::new();
    for (i, item) in pantry.iter().enumerate() {
        if item.name.is_empty() {
            continue;
        }
        for candidate in std::iter::once(&item.name).chain(item.aliases.iter()) {
            if candidate.is_empty() {
                continue;
            }
            exact.insert(candidate.to_lowercase(), i);
            let norm = normalize_ingredient_name(candidate);
            if norm.is_empty() {
                continue;
            }
            normalized.entry(norm.clone()).or_insert(i);
            let words = norm.split(' ').count();
            if (2..=3).contains(&words) {
                suffix.push((norm, i));
            }
        }
    }
    // Stable sort, longest first: "olive oil" beats "oil".
    suffix.sort_by(|a, b| b.0.len().cmp(&a.0.len()));
    PantryIndex { exact, normalized, suffix }
}

fn find(index: &PantryIndex, name: &str) -> Option<usize> {
    if name.is_empty() {
        return None;
    }
    if let Some(&i) = index.exact.get(&name.to_lowercase()) {
        return Some(i);
    }
    let norm = normalize_ingredient_name(name);
    if norm.is_empty() {
        return None;
    }
    if let Some(&i) = index.normalized.get(&norm) {
        return Some(i);
    }
    for (key, i) in &index.suffix {
        if key == &norm {
            continue;
        }
        if norm.len() > key.len() && norm.ends_with(&format!(" {key}")) {
            return Some(*i);
        }
    }
    None
}

/// Collapse (quantity, unit, item_size, item_size_unit) into one total.
fn to_total(
    quantity: Option<f64>,
    unit: Option<&str>,
    item_size: Option<f64>,
    item_size_unit: Option<&str>,
) -> (Option<f64>, Option<String>) {
    if let Some(size) = item_size {
        return (Some(quantity.unwrap_or(1.0) * size), item_size_unit.map(str::to_string));
    }
    (quantity, unit.map(str::to_string))
}

fn round3(n: f64) -> f64 {
    (n * 1000.0).round() / 1000.0
}

pub fn plan_pantry_decrement(
    recipe_servings: Option<i64>,
    servings: Option<i64>,
    lines: &[RecipeLine],
    pantry: &[PantryRow],
) -> Vec<PantryChange> {
    let scale = match (servings, recipe_servings) {
        (Some(s), Some(r)) if s > 0 && r > 0 => s as f64 / r as f64,
        _ => 1.0,
    };
    let index = build_index(pantry);
    // Two lines can hit the same row; the second subtracts from the first's result.
    let mut running: HashMap<String, Option<f64>> = HashMap::new();

    lines
        .iter()
        .map(|line| {
            let found = find(&index, &line.ingredient_name).map(|i| &pantry[i]);
            let mut change = PantryChange {
                recipe_ingredient: line.ingredient_name.clone(),
                ingredient_id: found.map(|p| p.id.clone()),
                pantry_name: found.map(|p| p.name.clone()),
                before: None,
                after: None,
                unit: found.and_then(|p| p.unit.clone()),
                status: "unmatched".to_string(),
            };
            let Some(item) = found else { return change };
            if item.always_on_hand {
                change.status = "always_on_hand".into();
                return change;
            }
            let current = running
                .get(&item.id)
                .copied()
                .unwrap_or(item.quantity);
            let Some(current) = current else {
                change.status = "untracked".into();
                return change;
            };
            change.before = Some(current);
            change.after = Some(current);
            if line.quantity.is_none() {
                change.status = "no_quantity".into();
                return change;
            }
            let (pantry_total, pantry_unit) = to_total(
                Some(current),
                item.unit.as_deref(),
                item.item_size,
                item.item_size_unit.as_deref(),
            );
            let (recipe_total, recipe_unit) = to_total(
                line.quantity,
                line.unit.as_deref(),
                line.item_size,
                line.item_size_unit.as_deref(),
            );
            let (Some(pantry_total), Some(recipe_total)) = (pantry_total, recipe_total) else {
                change.status = "no_quantity".into();
                return change;
            };
            let need = recipe_total * scale;
            let delta = if normalize_unit(pantry_unit.as_deref()) == normalize_unit(recipe_unit.as_deref()) {
                Some(need)
            } else {
                convert(need, recipe_unit.as_deref(), pantry_unit.as_deref())
            };
            let Some(delta) = delta else {
                change.status = "unconvertible".into();
                return change;
            };
            let new_total = (pantry_total - delta).max(0.0);
            let after = round3(match item.item_size {
                Some(size) => new_total / size,
                None => new_total,
            });
            running.insert(item.id.clone(), Some(after));
            change.after = Some(after);
            change.status = "decremented".into();
            change
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn row(id: &str, name: &str, qty: Option<f64>, unit: Option<&str>) -> PantryRow {
        PantryRow {
            id: id.into(),
            name: name.into(),
            aliases: vec![],
            quantity: qty,
            unit: unit.map(str::to_string),
            item_size: None,
            item_size_unit: None,
            always_on_hand: false,
        }
    }

    fn line(name: &str, qty: Option<f64>, unit: Option<&str>) -> RecipeLine {
        RecipeLine {
            ingredient_name: name.into(),
            quantity: qty,
            unit: unit.map(str::to_string),
            item_size: None,
            item_size_unit: None,
        }
    }

    #[test]
    fn normalizes_like_the_grocery_list() {
        assert_eq!(normalize_ingredient_name("Cream cheese, softened"), "cream cheese");
        assert_eq!(normalize_ingredient_name("Tomato sauce (15 oz can)"), "tomato sauce");
        assert_eq!(normalize_ingredient_name("  All-purpose   flour "), "all-purpose flour");
    }

    #[test]
    fn decrements_with_scaling_and_conversion() {
        let pantry = vec![row("milk", "Milk", Some(4.0), Some("cup")), row("eggs", "Eggs", Some(6.0), Some("whole"))];
        let lines = vec![
            line("milk", Some(8.0), Some("fl oz")), // 1 cup
            line("Eggs", Some(2.0), Some("whole")),
            line("salt", Some(1.0), Some("tsp")),
        ];
        // Recipe serves 2, cooking for 4 → double.
        let plan = plan_pantry_decrement(Some(2), Some(4), &lines, &pantry);
        assert_eq!(plan[0].status, "decremented");
        assert_eq!(plan[0].after, Some(2.0));
        assert_eq!(plan[1].after, Some(2.0));
        assert_eq!(plan[2].status, "unmatched");
    }

    #[test]
    fn clamps_at_zero_and_chains_two_lines_on_one_row() {
        let mut garlic = row("g", "Garlic", Some(3.0), Some("whole"));
        garlic.aliases = vec!["garlic cloves".into()];
        let pantry = vec![garlic];
        let lines = vec![line("garlic", Some(2.0), Some("whole")), line("garlic cloves", Some(5.0), Some("whole"))];
        let plan = plan_pantry_decrement(None, None, &lines, &pantry);
        assert_eq!(plan[0].after, Some(1.0));
        assert_eq!(plan[1].before, Some(1.0));
        assert_eq!(plan[1].after, Some(0.0));
    }

    #[test]
    fn item_size_rows_decrement_in_jars() {
        let mut jar = row("pb", "Peanut Butter", Some(3.0), Some("jar"));
        jar.item_size = Some(12.0);
        jar.item_size_unit = Some("fl oz".into());
        let plan = plan_pantry_decrement(None, None, &[line("peanut butter", Some(2.0), Some("cup"))], &[jar]);
        assert_eq!(plan[0].status, "decremented");
        // 36 fl oz − 16 fl oz = 20 fl oz = 1.667 jars
        assert_eq!(plan[0].after, Some(1.667));
    }

    #[test]
    fn reports_non_writes() {
        let mut aoh = row("s", "Salt", None, None);
        aoh.always_on_hand = true;
        let pantry = vec![aoh, row("f", "Flour", None, None), row("o", "Oil", Some(1.0), Some("cup"))];
        let lines = vec![line("salt", Some(1.0), Some("tsp")), line("flour", Some(1.0), Some("cup")), line("oil", Some(2.0), Some("oz")), line("oil", None, None)];
        let plan = plan_pantry_decrement(None, None, &lines, &pantry);
        assert_eq!(plan[0].status, "always_on_hand");
        assert_eq!(plan[1].status, "untracked");
        assert_eq!(plan[2].status, "unconvertible");
        assert_eq!(plan[3].status, "no_quantity");
    }
}
