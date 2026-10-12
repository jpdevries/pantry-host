import Head from 'next/head';
import GroceryListPage, { type GroceryListData } from '@/components/pages/GroceryListPage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<GroceryListData>('/list', ctx);
}

export default function ListPage({ initialData }: PageDataProps<GroceryListData>) {
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
      <GroceryListPage initialData={initialData} />
    </>
  );
}
