import { useRouter } from 'next/router';
import Head from 'next/head';
import RecipeDetailPage, { type Recipe } from '@/components/pages/RecipeDetailPage';
import { isBrowser } from '@pantry-host/shared/env';
import type { PageDataProps } from '@/lib/pageData';

export type RecipeDetailData = { recipe: Recipe | null };

/** Shared by /recipes/:slug and /kitchens/:kitchen/recipes/:slug. */
export default function RecipeDetailRoute({ initialData }: PageDataProps<RecipeDetailData>) {
  const initialRecipe = initialData?.recipe ?? null;
  const { slug } = useRouter().query;
  const fallback = isBrowser ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '';
  const recipeId = (slug as string) || initialRecipe?.slug || initialRecipe?.id || fallback;

  const ogTitle = initialRecipe?.title;
  const ogDescription = initialRecipe?.description;
  const ogImage = initialRecipe?.photoUrl;
  const title = ogTitle ? `${ogTitle} — Pantry Host` : 'Pantry Host';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="article" />
        {ogDescription && <meta property="og:description" content={ogDescription} />}
        {ogDescription && <meta name="description" content={ogDescription} />}
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
      </Head>
      <RecipeDetailPage recipeId={recipeId} initialRecipe={initialRecipe} />
    </>
  );
}
