import Head from 'next/head';
import RecipesIndexPage, { type RecipesIndexData } from '@/components/pages/RecipesIndexPage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<RecipesIndexData>('/recipes', ctx);
}

export default function RecipesPage({ initialData, query }: PageDataProps<RecipesIndexData>) {
  return (
    <>
      <Head>
        <title>Recipes — Pantry Host</title>
        <meta name="description" content="Browse family recipes — filter by dietary preference, meal type, or cooking method." />
        <meta property="og:title" content="Recipes — Pantry Host" />
        <meta property="og:description" content="Browse family recipes — filter by dietary preference, meal type, or cooking method." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <RecipesIndexPage initialData={initialData} query={query} />
    </>
  );
}
