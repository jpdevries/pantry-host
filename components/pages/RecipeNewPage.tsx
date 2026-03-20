import Head from 'next/head';
import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import RecipeForm from '@/components/RecipeForm';

interface Props { kitchen: string; }

export default function RecipeNewPage({ kitchen }: Props) {
  const [existingRecipes, setExistingRecipes] = useState<{ id: string; title: string; source: string }[]>([]);
  const [cookwareItems, setCookwareItems] = useState<string[]>([]);
  const [allTags, setAllTags] = useState<string[]>([]);
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  useEffect(() => {
    const slug = kitchen || 'home';
    Promise.all([
      gql<{ recipes: { id: string; title: string; source: string; tags: string[] }[] }>('{ recipes { id title source tags } }'),
      gql<{ cookware: { name: string }[] }>(`query Cookware($kitchenSlug: String) { cookware(kitchenSlug: $kitchenSlug) { name } }`, { kitchenSlug: slug }),
    ]).then(([r, c]) => {
      setExistingRecipes(r.recipes);
      setCookwareItems(c.cookware.map((i) => i.name));
      const tags = new Set<string>();
      r.recipes.forEach((rec) => rec.tags?.forEach((t) => tags.add(t)));
      setAllTags([...tags].sort());
    }).catch(console.error);
  }, [kitchen]);

  return (
    <>
      <Head><title>Add Recipe — Pantry Host</title></Head>
      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
        <div className="mb-8">
          <a href={`${recipesBase}#stage`} className="text-sm text-zinc-500 hover:text-accent transition-colors">
            ← Recipes
          </a>
          <h1 className="text-4xl font-bold mt-2">Add Recipe</h1>
        </div>
        <RecipeForm existingRecipes={existingRecipes} cookwareItems={cookwareItems} allTags={allTags} recipesBase={recipesBase} kitchenSlug={kitchen} />
      </main>
    </>
  );
}
