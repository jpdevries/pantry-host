import Head from 'next/head';
import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import RecipeCard from '@/components/RecipeCard';

interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  source: string;
  tags: string[];
  photoUrl: string | null;
  queued: boolean;
}

interface CookwareItem {
  id: string;
  name: string;
  brand: string | null;
  tags: string[];
  recipes: Recipe[];
}

const COOKWARE_ITEM_QUERY = `
  query CookwareItem($id: String!) {
    cookwareItem(id: $id) {
      id name brand tags
      recipes { id slug title cookTime prepTime servings source tags photoUrl queued }
    }
  }
`;

interface Props { id: string; kitchen: string; }

export default function CookwareDetailPage({ id, kitchen }: Props) {
  const [item, setItem] = useState<CookwareItem | null>(null);
  const [notFound, setNotFound] = useState(false);

  const cookwareBase = kitchen === 'home' ? '/cookware' : `/kitchens/${kitchen}/cookware`;
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  useEffect(() => {
    if (!id) return;
    gql<{ cookwareItem: CookwareItem | null }>(COOKWARE_ITEM_QUERY, { id })
      .then((d) => {
        if (d.cookwareItem) setItem(d.cookwareItem);
        else setNotFound(true);
      })
      .catch(console.error);
  }, [id]);

  return (
    <>
      <Head><title>{item ? `${item.name} — Cookware` : 'Cookware'} — Pantry Host</title></Head>

      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-4xl mx-auto">
        <div className="mb-8">
          <a href={`${cookwareBase}#stage`} className="text-sm text-[var(--color-text-secondary)] hover:text-accent transition-colors">
            ← Cookware
          </a>
        </div>

        {notFound && (
          <p className="text-[var(--color-text-secondary)]">Cookware item not found.</p>
        )}

        {item && (
          <>
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-1">{item.name}</h1>
              {item.brand && (
                <p className="text-[var(--color-text-secondary)]">{item.brand}</p>
              )}
              {item.tags.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {item.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                </div>
              )}
            </div>

            <section aria-labelledby="recipes-heading">
              <h2 id="recipes-heading" className="text-xl font-bold mb-4">
                Recipes using this cookware
              </h2>

              {item.recipes.length === 0 ? (
                <p className="text-[var(--color-text-secondary)]">
                  No recipes require this cookware yet.
                </p>
              ) : (
                <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
                  {item.recipes.map((r) => (
                    <li key={r.id} className="grid grid-rows-[subgrid] row-span-5">
                      <RecipeCard recipe={r} recipesBase={recipesBase} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}
