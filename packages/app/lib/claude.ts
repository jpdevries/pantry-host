import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true, // Rex V8 SSR is server-side, not a real browser
});

interface GeneratedIngredient {
  ingredientName: string;
  quantity?: number | null;
  unit?: string | null;
  /** Per-item size when ingredient comes in discrete packaged units (e.g. 16 oz per steak) */
  itemSize?: number | null;
  itemSizeUnit?: string | null;
}

interface GeneratedRecipe {
  title: string;
  description?: string;
  instructions: string;
  servings?: number;
  prepTime?: number;
  cookTime?: number;
  tags?: string[];
  requiredCookware?: string[];
  ingredients: GeneratedIngredient[];
}

/**
 * Experimental: invents recipes from scratch out of the pantry + cookware.
 * The model is much better at adapting existing recipes than inventing new
 * ones, so treat the output as ideas to riff on, not tested recipes.
 */
export async function generateRecipes(
  ingredients: { name: string; quantity: number | null; unit: string | null; itemSize?: number | null; itemSizeUnit?: string | null }[],
  cookware: { name: string; tags?: string[]; notes?: string | null }[],
): Promise<GeneratedRecipe[]> {
  const ingredientList = ingredients
    .map((i) => {
      const qty = i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : '';
      // Include per-item size context: "tomato paste (3 can × 6 oz)"
      const size = i.itemSize != null ? ` × ${i.itemSize}${i.itemSizeUnit ?? ''}` : '';
      const qtyPart = qty || size ? `${qty}${size}`.trim() : '';
      return qtyPart ? `${i.name} (${qtyPart})` : i.name;
    })
    .join(', ');

  const cookwareList = cookware.map((c) => c.name).join(', ') || 'standard kitchen equipment';

  // Build composting context if any cookware is tagged as a composter/waste-cycler
  const composters = cookware.filter((c) =>
    (c.tags ?? []).some((t) => ['waste-cycler', 'compost'].includes(t)),
  );
  const compostContext = composters.length > 0
    ? `\n\nThe family owns ${composters.map((c) => `a ${c.name}${c.notes ? ` (composting device — ${c.notes})` : ' (composting device)'}`).join(' and ')}. For each recipe, append a final instruction step starting with "Compost:" listing which scraps from that recipe can go into the composter and which cannot, based on the device's rules.`
    : '';

  const prompt = `You are a helpful home chef.

Available ingredients: ${ingredientList || 'none listed'}
Available cookware: ${cookwareList}

Generate 3 practical family recipes using primarily these ingredients. Favor cookware the family owns. Default to 2 servings unless ingredients clearly suggest more.

Tag guidance:
- If a recipe contains alcohol, high-mercury fish (swordfish, king mackerel, tilefish, bigeye tuna), or excessive caffeine, add the "breastfeeding-alert" tag.
- If a recipe features galactagogues (oats, fenugreek, brewer's yeast, flaxseed, fennel), add the "lactation" tag.
- Do NOT add "breastfeeding-safe" automatically — that is user opt-in only.

Ingredient item_size guidance:
- Use itemSize / itemSizeUnit when an ingredient is packaged in discrete countable units with a measurable size (e.g. "2 16oz pepper steaks" → quantity 2, unit "whole", itemSize 16, itemSizeUnit "oz"; "1 15oz can of beans" → quantity 1, unit "can", itemSize 15, itemSizeUnit "oz").
- Leave itemSize/itemSizeUnit null for bulk measurements (e.g. "2 cups flour" → quantity 2, unit "cup", itemSize null).${compostContext}

Respond with ONLY a valid JSON array — no markdown, no explanation — matching this schema:
[
  {
    "title": "string",
    "description": "string",
    "instructions": "string (full step-by-step, each step on a new line starting with a number)",
    "servings": number,
    "prepTime": number (minutes),
    "cookTime": number (minutes),
    "tags": ["string"],
    "requiredCookware": ["string"],
    "ingredients": [
      { "ingredientName": "string", "quantity": number | null, "unit": "string | null", "itemSize": number | null, "itemSizeUnit": "string | null" }
    ]
  }
]`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 1.0,
    messages: [{ role: 'user', content: prompt }],
  });

  const text = message.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { type: 'text'; text: string }).text)
    .join('');

  // Strip any accidental markdown code fences
  const cleaned = text.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '').trim();

  const parsed: GeneratedRecipe[] = JSON.parse(cleaned);
  return parsed;
}
