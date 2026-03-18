import Head from 'next/head';
import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import RecipeForm from '@/components/RecipeForm';

interface Props { kitchen: string; }

export default function RecipeNewPage({ kitchen }: Props) {
  const [existingRecipes, setExistingRecipes] = useState<{ id: string; title: string; source: string }[]>([]);
  const [cookwareItems, setCookwareItems] = useState<string[]>([]);
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  useEffect(() => {
    const slug = kitchen || 'home';
    Promise.all([
      gql<{ recipes: { id: string; title: string; source: string }[] }>('{ recipes { id title source } }'),
      gql<{ cookware: { name: string }[] }>(`query Cookware($kitchenSlug: String) { cookware(kitchenSlug: $kitchenSlug) { name } }`, { kitchenSlug: slug }),
    ]).then(([r, c]) => {
      setExistingRecipes(r.recipes);
      setCookwareItems(c.cookware.map((i) => i.name));
    }).catch(console.error);
  }, [kitchen]);

  return (
    <>
      <Head><title>Add Recipe — Pantry List</title></Head>
      <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <a href={`${recipesBase}#stage`} className="text-sm text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 transition-colors">
            ← Recipes
          </a>
          <h1 className="text-4xl font-bold mt-2">Add Recipe</h1>
        </div>
        <RecipeForm existingRecipes={existingRecipes} cookwareItems={cookwareItems} recipesBase={recipesBase} kitchenSlug={kitchen} />
      </main>
    </>
  );
}
