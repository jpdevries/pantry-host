import Head from 'next/head';
import CookwarePageComponent, { type CookwareIndexData } from '@/components/pages/CookwarePage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<CookwareIndexData>('/cookware', ctx);
}

export default function CookwarePage({ initialData }: PageDataProps<CookwareIndexData>) {
  return (
    <>
      <Head>
        <title>Cookware — Pantry Host</title>
        <meta name="description" content="Track your kitchen equipment so AI suggestions stay realistic." />
        <meta property="og:title" content="Cookware — Pantry Host" />
        <meta property="og:description" content="Track your kitchen equipment so AI suggestions stay realistic." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <CookwarePageComponent initialData={initialData} />
    </>
  );
}
