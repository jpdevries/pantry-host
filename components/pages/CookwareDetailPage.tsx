import Head from 'next/head';
import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';

interface Recipe {
  id: string;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  source: string;
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
      recipes { id title cookTime prepTime source }
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
          <a href={`${cookwareBase}#stage`} className="text-sm text-zinc-500 hover:text-accent transition-colors">
            ← Cookware
          </a>
        </div>

        {notFound && (
          <p className="text-zinc-500">Cookware item not found.</p>
        )}

        {item && (
          <>
            <div className="mb-8">
              <h1 className="text-4xl font-bold mb-1">{item.name}</h1>
              {item.brand && (
                <p className="text-zinc-500 dark:text-zinc-400">{item.brand}</p>
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
                <p className="text-zinc-500 dark:text-zinc-400">
                  No recipes require this cookware yet.
                </p>
              ) : (
                <ul className="divide-y divide-zinc-200 dark:divide-zinc-800" role="list">
                  {item.recipes.map((r) => (
                    <li key={r.id}>
                      <a
                        href={`${recipesBase}/${r.id}#stage`}
                        className="flex items-center justify-between py-3 hover:text-accent transition-colors"
                      >
                        <span className="font-medium">{r.title}</span>
                        <span className="text-sm text-zinc-500 dark:text-zinc-400 shrink-0 ml-4">
                          {r.cookTime != null ? `${r.cookTime} min` : r.prepTime != null ? `${r.prepTime} min` : ''}
                          {r.source === 'ai-generated' && <span className="ml-2 tag">AI</span>}
                        </span>
                      </a>
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
