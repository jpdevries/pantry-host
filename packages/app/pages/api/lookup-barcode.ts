import type { NextApiRequest, NextApiResponse } from 'next';

interface BarcodeResult {
  name: string;
  category?: string;
  quantity?: number;
  unit?: string;
  brand?: string;
}

// Map Open Food Facts categories to our predefined categories
function mapCategory(categories: string): string {
  const lower = categories.toLowerCase();
  // Check "frozen" first — "frozen blueberries" should be frozen, not fruit
  if (lower.includes('frozen')) return 'frozen';
  if (lower.includes('fruit') || lower.includes('berry') || lower.includes('melon')) return 'fruit';
  if (lower.includes('produce') || lower.includes('vegetable') || lower.includes('salad')) return 'vegetables';
  if (lower.includes('dairy') || lower.includes('milk') || lower.includes('cheese') || lower.includes('yogurt')) return 'dairy';
  if (lower.includes('egg')) return 'eggs';
  if (lower.includes('seafood') || lower.includes('fish') || lower.includes('shrimp') || lower.includes('salmon')) return 'seafood & fish';
  if (lower.includes('meat') || lower.includes('poultry') || lower.includes('chicken') || lower.includes('beef') || lower.includes('pork')) return 'meat & poultry';
  if (lower.includes('tofu') || lower.includes('tempeh') || lower.includes('soy')) return 'tofu & tempeh';
  if (lower.includes('bean') || lower.includes('lentil') || lower.includes('legume') || lower.includes('chickpea')) return 'legumes & pulses';
  if (lower.includes('almond milk') || lower.includes('oat milk') || lower.includes('soy milk') || lower.includes('coconut milk') || lower.includes('plant-based milk') || lower.includes('rice milk')) return 'plant-based milks';
  if (lower.includes('nut') || lower.includes('seed') || lower.includes('almond') || lower.includes('peanut')) return 'nuts & seeds';
  if (lower.includes('deli') || lower.includes('charcuterie') || lower.includes('sausage') || lower.includes('salami')) return 'deli & charcuterie';
  if (lower.includes('beverage') || lower.includes('drink') || lower.includes('juice') || lower.includes('soda') || lower.includes('water') || lower.includes('coffee') || lower.includes('tea')) return 'beverages';
  if (lower.includes('condiment') || lower.includes('sauce') || lower.includes('ketchup') || lower.includes('mustard') || lower.includes('mayo')) return 'condiments & sauces';
  if (lower.includes('oil') || lower.includes('vinegar')) return 'oils & vinegars';
  if (lower.includes('spice') || lower.includes('herb') || lower.includes('seasoning')) return 'herbs & spices';
  if (lower.includes('flour') || lower.includes('sugar') || lower.includes('baking')) return 'baking';
  if (lower.includes('snack') || lower.includes('chip') || lower.includes('cracker') || lower.includes('cookie')) return 'snacks';
  if (lower.includes('can') || lower.includes('jar') || lower.includes('canned')) return 'canned & jarred';
  if (lower.includes('grain') || lower.includes('rice') || lower.includes('pasta') || lower.includes('cereal') || lower.includes('bread')) return 'dry goods & grains';
  return 'other';
}

const ML_PER_FLOZ = 29.5735;
const G_PER_OZ = 28.3495;

function toImperial(qty: number, unit: string): { qty: number; unit: string } {
  if (unit === 'ml') {
    const floz = qty / ML_PER_FLOZ;
    // Use fl oz for anything under a gallon
    const rounded = Math.round(floz * 2) / 2; // round to nearest 0.5
    if (rounded >= 128) return { qty: Math.round(floz / 128 * 10) / 10, unit: 'gal' };
    if (rounded >= 32) return { qty: Math.round(floz / 32 * 10) / 10, unit: 'qt' };
    return { qty: rounded || 1, unit: 'fl oz' };
  }
  if (unit === 'L') {
    return toImperial(qty * 1000, 'ml');
  }
  if (unit === 'g') {
    const oz = qty / G_PER_OZ;
    if (oz >= 16) {
      const lb = Math.round(oz / 16 * 10) / 10;
      return { qty: lb, unit: 'lb' };
    }
    const rounded = Math.round(oz * 2) / 2;
    return { qty: rounded || 1, unit: 'oz' };
  }
  if (unit === 'kg') {
    return toImperial(qty * 1000, 'g');
  }
  return { qty, unit };
}

export default async function handler(req: NextApiRequest, res: NextApiResponse<BarcodeResult | { error: string }>) {
  const { code } = req.query as { code?: string };
  if (!code) return res.status(400).json({ error: 'code is required' });

  try {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 8_000);
    const response = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=product_name,brands,categories_tags,quantity,product_quantity,product_quantity_unit`,
      {
        headers: { 'User-Agent': 'PantryListApp/1.0 (family recipe management)' },
        signal: ac.signal,
      },
    );
    clearTimeout(timer);

    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json() as {
      status: number;
      product?: {
        product_name?: string;
        brands?: string;
        categories_tags?: string[];
        quantity?: string;
        product_quantity?: number | string;
        product_quantity_unit?: string;
      };
    };

    if (data.status === 0 || !data.product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const product = data.product;
    const name = product.product_name?.trim() || '';
    if (!name) return res.status(404).json({ error: 'Product found but name is missing' });
    const brand = product.brands?.split(',')[0]?.trim();
    const categoriesRaw = product.categories_tags?.join(' ') ?? '';
    const category = mapCategory(categoriesRaw);

    // Extract quantity and unit from API response
    // Prefer structured product_quantity / product_quantity_unit fields,
    // fall back to parsing the raw quantity string (e.g. "500 ml", "1 lb")
    let qty: number | undefined;
    let unit: string | undefined;

    // Map OFF unit strings to our unit constants
    const unitMap: Record<string, string> = {
      ml: 'ml', milliliter: 'ml', millilitre: 'ml', milliliters: 'ml', millilitres: 'ml',
      l: 'L', liter: 'L', litre: 'L', liters: 'L', litres: 'L',
      oz: 'oz', ounce: 'oz', ounces: 'oz', 'fl oz': 'fl oz',
      lb: 'lb', lbs: 'lb', pound: 'lb', pounds: 'lb',
      g: 'g', gram: 'g', grams: 'g',
      kg: 'kg', kilogram: 'kg', kilograms: 'kg',
    };

    if (product.product_quantity != null) {
      const pq = typeof product.product_quantity === 'string'
        ? parseFloat(product.product_quantity)
        : product.product_quantity;
      if (!isNaN(pq) && pq > 0) qty = pq;
    }

    if (product.product_quantity_unit) {
      unit = unitMap[product.product_quantity_unit?.toLowerCase()] ?? undefined;
    }

    // Fall back to parsing the raw quantity string
    const qtyStr = product.quantity ?? '';
    if (qtyStr) {
      // Extract numeric value if we don't already have one
      if (qty == null) {
        const numMatch = qtyStr.match(/([\d.]+)/);
        if (numMatch) qty = parseFloat(numMatch[1]);
      }

      // Extract unit if we don't already have one
      if (!unit) {
        if (/fl\s*oz/i.test(qtyStr)) unit = 'fl oz';
        else if (/ml|milliliter|millilitre/i.test(qtyStr)) unit = 'ml';
        else if (/\bl\b|liter|litre/i.test(qtyStr)) unit = 'L';
        else if (/\boz\b/i.test(qtyStr)) unit = 'oz';
        else if (/\blbs?\b|pound/i.test(qtyStr)) unit = 'lb';
        else if (/\bkg\b|kilogram/i.test(qtyStr)) unit = 'kg';
        else if (/\bg\b(?!rain)|gram/i.test(qtyStr)) unit = 'g';
        else if (/\bgal\b|gallon/i.test(qtyStr)) unit = 'gal';
        else if (/\bqt\b|quart/i.test(qtyStr)) unit = 'qt';
        else if (/\bpt\b|pint/i.test(qtyStr)) unit = 'pt';
        else if (/\bcup/i.test(qtyStr)) unit = 'cup';
      }
    }

    if (!unit) unit = 'whole';

    // Convert metric to imperial for common US product sizes
    if (qty != null) {
      const converted = toImperial(qty, unit);
      qty = converted.qty;
      unit = converted.unit;
    }

    return res.json({ name, brand, category, quantity: qty, unit });
  } catch (err) {
    return res.status(502).json({ error: `Lookup failed: ${(err as Error).message}` });
  }
}
