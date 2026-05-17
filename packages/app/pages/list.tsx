import Head from 'next/head';
import GroceryListPage from '@/components/pages/GroceryListPage';
export default function ListPage() {
  return (
    <>
      <Head>
        <title>Grocery List — Pantry Host</title>
        <meta name="description" content="Your grocery shopping list, informed by queued recipes and pantry inventory." />
        <meta property="og:title" content="Grocery List — Pantry Host" />
        <meta property="og:description" content="Your grocery shopping list, informed by queued recipes and pantry inventory." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <GroceryListPage />
    </>
  );
}
