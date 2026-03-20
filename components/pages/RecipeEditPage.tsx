import Head from 'next/head';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { gql } from '@/lib/gql';
import RecipeForm from '@/components/RecipeForm';

interface RecipeIngredient {
  ingredientName: string;
  quantity: number | null;
  unit: string | null;
  sourceRecipeId: string | null;
}

interface Recipe {
  id: string;
  title: string;
  description: string | null;
  instructions: string;
  servings: number | null;
  prepTime: number | null;
  cookTime: number | null;
  tags: string[];
  requiredCookware: string[];
  photoUrl: string | null;
  ingredients: RecipeIngredient[];
}

const EDIT_QUERY = `
  query EditRecipe($id: String!, $kitchenSlug: String) {
    recipe(id: $id) {
      id title description instructions servings prepTime cookTime
      tags requiredCookware photoUrl
      ingredients { ingredientName quantity unit sourceRecipeId }
    }
    recipes { id title source tags }
    cookware(kitchenSlug: $kitchenSlug) { name }
  }
`;

interface Props { kitchen: string; recipeId: string; }

export default function RecipeEditPage({ kitchen, recipeId }: Props) {
  const router = useRouter();
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [existingRecipes, setExistingRecipes] = useState<{ id: string; title: string; source: string }[]>([]);
  const [cookwareItems, setCookwareItems] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    if (!recipeId) return;
    gql<{ recipe: Recipe | null; recipes: { id: string; title: string; source: string; tags: string[] }[]; cookware: { name: string }[] }>(
      EDIT_QUERY, { id: recipeId, kitchenSlug: kitchen || 'home' }
    ).then((d) => {
        if (!d.recipe) return;
        setRecipe(d.recipe);
        setExistingRecipes(d.recipes.filter((r) => r.id !== recipeId));
        setCookwareItems(d.cookware.map((c) => c.name));
        const tags = new Set<string>();
        d.recipes.forEach((r) => r.tags?.forEach((t) => tags.add(t)));
        setAllTags([...tags].sort());
      })
      .catch(console.error);
  }, [recipeId, kitchen]);

  if (!recipe) {
    return <main id="stage" className="max-sm:min-h-screen" aria-busy="true" />;
  }

  return (
    <>
      <Head><title>Edit {recipe.title} — Pantry Host</title></Head>
      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <a href={`${recipesBase}/${recipe.id}#stage`} className="text-sm text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            ← {recipe.title}
          </a>
          <h1 className="text-4xl font-bold mt-2">Edit Recipe</h1>
        </div>
        <RecipeForm
          initial={{
            id: recipe.id,
            title: recipe.title,
            description: recipe.description ?? undefined,
            instructions: recipe.instructions,
            servings: recipe.servings ?? 2,
            prepTime: recipe.prepTime ?? undefined,
            cookTime: recipe.cookTime ?? undefined,
            tags: recipe.tags,
            requiredCookware: recipe.requiredCookware,
            photoUrl: recipe.photoUrl ?? undefined,
            ingredients: recipe.ingredients.map((i) => ({
              ingredientName: i.ingredientName,
              quantity: i.quantity,
              unit: i.unit,
              sourceRecipeId: i.sourceRecipeId,
            })),
          }}
          existingRecipes={existingRecipes}
          cookwareItems={cookwareItems}
          allTags={allTags}
          recipesBase={recipesBase}
        />
      </main>
    </>
  );
}
