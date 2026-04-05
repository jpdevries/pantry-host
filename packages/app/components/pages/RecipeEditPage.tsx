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
  requiredCookware: { id: string; name: string }[];
  photoUrl: string | null;
  stepPhotos: string[];
  ingredients: RecipeIngredient[];
}

const EDIT_QUERY = `
  query EditRecipe($id: String!, $kitchenSlug: String) {
    recipe(id: $id) {
      id title description instructions servings prepTime cookTime
      tags requiredCookware { id name } photoUrl stepPhotos
      ingredients { ingredientName quantity unit sourceRecipeId }
    }
    recipes { id slug title source tags }
    cookware(kitchenSlug: $kitchenSlug) { id name tags }
  }
`;

interface Props { kitchen: string; recipeId: string; }

export default function RecipeEditPage({ kitchen, recipeId }: Props) {
  const router = useRouter();
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [existingRecipes, setExistingRecipes] = useState<{ id: string; slug?: string; title: string; source: string }[]>([]);
  const [cookwareItems, setCookwareItems] = useState<{ id: string; name: string; tags: string[] }[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);

  useEffect(() => {
    if (!recipeId) return;
    gql<{ recipe: Recipe | null; recipes: { id: string; slug: string; title: string; source: string; tags: string[] }[]; cookware: { id: string; name: string; tags: string[] }[] }>(
      EDIT_QUERY, { id: recipeId, kitchenSlug: kitchen || 'home' }
    ).then((d) => {
        if (!d.recipe) return;
        setRecipe(d.recipe);
        setExistingRecipes(d.recipes.filter((r) => r.id !== recipeId));
        setCookwareItems(d.cookware);
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
          <a href={`${recipesBase}/${recipe.id}#stage`} className="text-sm text-[var(--color-text-secondary)] hover:text-accent transition-colors">
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
            requiredCookware: recipe.requiredCookware.map((c) => c.name),
            photoUrl: recipe.photoUrl ?? undefined,
            stepPhotos: recipe.stepPhotos ?? [],
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
