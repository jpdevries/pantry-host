import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';

const CREATE_MUTATION = `mutation(
  $title: String!,
  $description: String,
  $instructions: String!,
  $servings: Int,
  $prepTime: Int,
  $cookTime: Int,
  $tags: [String!],
  $ingredients: [RecipeIngredientInput!]!
) {
  createRecipe(
    title: $title,
    description: $description,
    instructions: $instructions,
    servings: $servings,
    prepTime: $prepTime,
    cookTime: $cookTime,
    tags: $tags,
    ingredients: $ingredients
  ) { id slug }
}`;

export default function RecipeNewPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [instructions, setInstructions] = useState('');
  const [servings, setServings] = useState('2');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [tags, setTags] = useState('');
  const [ingredientLines, setIngredientLines] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !instructions.trim()) return;
    setSaving(true);

    const ingredients = ingredientLines
      .split('\n')
      .filter((l) => l.trim())
      .map((line) => {
        const match = line.match(/^(\d+\.?\d*)\s*(\w+)?\s+(.+)$/);
        if (match) {
          return {
            ingredientName: match[3].trim(),
            quantity: parseFloat(match[1]),
            unit: match[2] || null,
          };
        }
        return { ingredientName: line.trim() };
      });

    try {
      const { createRecipe } = await gql<{ createRecipe: { slug: string } }>(CREATE_MUTATION, {
        title: title.trim(),
        description: description.trim() || null,
        instructions: instructions.trim(),
        servings: servings ? parseInt(servings) : null,
        prepTime: prepTime ? parseInt(prepTime) : null,
        cookTime: cookTime ? parseInt(cookTime) : null,
        tags: tags ? tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        ingredients,
      });
      navigate(`/recipes/${createRecipe.slug}#stage`);
    } catch (err) {
      console.error(err);
      setSaving(false);
    }
  }

  return (
    <div>
      <Link to="/recipes" className="text-sm text-[var(--color-text-secondary)] hover:underline mb-4 inline-block">
        &larr; Back to recipes
      </Link>

      <h1
        className="text-3xl font-bold mb-6"
      >
        New Recipe
      </h1>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-sm font-medium mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            autoFocus
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-card)] bg-[var(--color-bg-card)] text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Description</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-card)] bg-[var(--color-bg-card)] text-sm"
          />
        </div>

        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Servings</label>
            <input type="number" value={servings} onChange={(e) => setServings(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-card)] bg-[var(--color-bg-card)] text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prep (min)</label>
            <input type="number" value={prepTime} onChange={(e) => setPrepTime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-card)] bg-[var(--color-bg-card)] text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Cook (min)</label>
            <input type="number" value={cookTime} onChange={(e) => setCookTime(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-card)] bg-[var(--color-bg-card)] text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="dinner, italian, quick"
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-card)] bg-[var(--color-bg-card)] text-sm"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Ingredients (one per line)</label>
          <textarea
            value={ingredientLines}
            onChange={(e) => setIngredientLines(e.target.value)}
            rows={6}
            placeholder={"2 cups flour\n1 tsp salt\n3 eggs"}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-card)] bg-[var(--color-bg-card)] text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Instructions</label>
          <textarea
            value={instructions}
            onChange={(e) => setInstructions(e.target.value)}
            required
            rows={8}
            className="w-full px-3 py-2 rounded-lg border border-[var(--color-border-card)] bg-[var(--color-bg-card)] text-sm"
          />
        </div>

        <button
          type="submit"
          disabled={saving}
          className="px-6 py-2.5 rounded-lg font-semibold text-sm bg-[var(--color-accent)] text-[var(--color-bg-body)] hover:underline disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Create recipe'}
        </button>
      </form>
    </div>
  );
}
