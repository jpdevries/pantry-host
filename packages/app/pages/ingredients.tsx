import Head from 'next/head';
import IngredientsPageComponent, { type IngredientsIndexData } from '@/components/pages/IngredientsPage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<IngredientsIndexData>('/ingredients', ctx);
}

export default function IngredientsPage({ initialData }: PageDataProps<IngredientsIndexData>) {
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
      <IngredientsPageComponent initialData={initialData} />
    </>
  );
}
