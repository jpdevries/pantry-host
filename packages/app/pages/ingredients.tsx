import Head from 'next/head';
import IngredientsPageComponent from '@/components/pages/IngredientsPage';
export default function IngredientsPage() {
  return (
    <>
      <Head>
        <title>Pantry — Pantry Host</title>
        <meta name="description" content="Track your kitchen ingredients by category with quantities and tags." />
        <meta property="og:title" content="Pantry — Pantry Host" />
        <meta property="og:description" content="Track your kitchen ingredients by category with quantities and tags." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <IngredientsPageComponent />
    </>
  );
}
