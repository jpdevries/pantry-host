import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.AI_API_KEY || process.env.ANTHROPIC_API_KEY,
  dangerouslyAllowBrowser: true, // Rex V8 SSR is server-side, not a real browser
});

interface GeneratedIngredient {
  ingredientName: string;
  quantity?: number | null;
  unit?: string | null;
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

export async function generateRecipes(
  ingredients: { name: string; quantity: number | null; unit: string | null }[],
  cookware: { name: string; tags?: string[]; notes?: string | null }[],
): Promise<GeneratedRecipe[]> {
  const ingredientList = ingredients
    .map((i) => {
      const qty = i.quantity != null ? `${i.quantity} ${i.unit ?? ''}`.trim() : '';
      return qty ? `${i.name} (${qty})` : i.name;
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
- Do NOT add "breastfeeding-safe" automatically — that is user opt-in only.${compostContext}

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
      { "ingredientName": "string", "quantity": number | null, "unit": "string | null" }
    ]
  }
]`;

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 1.2,
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
