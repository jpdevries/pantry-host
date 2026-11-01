//! Unit conversion for pantry ↔ recipe quantity matching.
//!
//! Port of `packages/shared/src/units.ts`. Keep the two in lock-step: volume
//! (base ml) and weight (base g), with the same alias list. Cross-category
//! conversions return `None`; callers fall back to presence semantics.
//! Bare "oz" is a weight ounce; "fl_oz" / "fluid ounce" is volume.

fn volume_ml(key: &str) -> Option<f64> {
    Some(match key {
        "ml" => 1.0,
        "l" => 1000.0,
        "tsp" => 4.92892,
        "tbsp" => 14.7868,
        "fl_oz" => 29.5735,
        "cup" => 236.588,
        "pint" => 473.176,
        "quart" => 946.353,
        "gallon" => 3785.41,
        _ => return None,
    })
}

fn weight_g(key: &str) -> Option<f64> {
    Some(match key {
        "g" => 1.0,
        "kg" => 1000.0,
        "mg" => 0.001,
        "oz" => 28.3495,
        "lb" => 453.592,
        _ => return None,
    })
}

fn alias(key: &str) -> Option<&'static str> {
    Some(match key {
        // volume
        "tablespoon" | "tablespoons" | "t" | "tbsps" => "tbsp",
        "teaspoon" | "teaspoons" | "tsps" => "tsp",
        "fluid ounce" | "fluid ounces" | "fl. oz." | "fl oz" | "floz" => "fl_oz",
        "cups" => "cup",
        "pints" => "pint",
        "quarts" => "quart",
        "gallons" => "gallon",
        "milliliter" | "milliliters" | "millilitre" | "millilitres" => "ml",
        "liter" | "liters" | "litre" | "litres" => "l",
        // weight — bare "oz" means weight ounce here
        "ounce" | "ounces" => "oz",
        "pound" | "pounds" | "lbs" => "lb",
        "gram" | "grams" => "g",
        "kilogram" | "kilograms" => "kg",
        "milligram" | "milligrams" => "mg",
        _ => return None,
    })
}

/// Lowercase, trim, collapse whitespace, then map aliases to the canonical
/// key. `None` for an empty or missing unit.
pub fn normalize_unit(u: Option<&str>) -> Option<String> {
    let u = u?;
    let key = u
        .trim()
        .to_lowercase()
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");
    if key.is_empty() {
        return None;
    }
    Some(alias(&key).map(str::to_string).unwrap_or(key))
}

/// Convert `qty` between units. `None` when either unit is missing or the
/// units don't share a category. Same-unit conversions return `qty` even for
/// units outside the table ("whole" → "whole").
pub fn convert(qty: f64, from: Option<&str>, to: Option<&str>) -> Option<f64> {
    let from = normalize_unit(from)?;
    let to = normalize_unit(to)?;
    if from == to {
        return Some(qty);
    }
    if let (Some(a), Some(b)) = (volume_ml(&from), volume_ml(&to)) {
        return Some(qty * a / b);
    }
    if let (Some(a), Some(b)) = (weight_g(&from), weight_g(&to)) {
        return Some(qty * a / b);
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn aliases_and_whitespace() {
        assert_eq!(normalize_unit(Some(" Tablespoons ")).as_deref(), Some("tbsp"));
        assert_eq!(normalize_unit(Some("fl  oz")).as_deref(), Some("fl_oz"));
        assert_eq!(normalize_unit(Some("whole")).as_deref(), Some("whole"));
        assert_eq!(normalize_unit(Some("  ")), None);
        assert_eq!(normalize_unit(None), None);
    }

    #[test]
    fn converts_within_a_category_only() {
        assert!((convert(2.0, Some("cups"), Some("fl oz")).unwrap() - 16.0).abs() < 0.01);
        assert!((convert(1.0, Some("lb"), Some("oz")).unwrap() - 16.0).abs() < 0.01);
        assert_eq!(convert(1.0, Some("cup"), Some("oz")), None);
        assert_eq!(convert(3.0, Some("whole"), Some("whole")), Some(3.0));
        assert_eq!(convert(3.0, None, Some("whole")), None);
    }
}
