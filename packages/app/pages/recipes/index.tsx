import Head from 'next/head';
import RecipesIndexPage from '@/components/pages/RecipesIndexPage';
export default function RecipesPage() {
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
      <RecipesIndexPage />
    </>
  );
}
