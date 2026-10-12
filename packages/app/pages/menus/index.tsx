import Head from 'next/head';
import MenusIndexPage, { type MenusIndexData } from '@/components/pages/MenusIndexPage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<MenusIndexData>('/menus', ctx);
}

export default function MenusPage({ initialData }: PageDataProps<MenusIndexData>) {
  return (
    <>
      <Head>
        <title>Menus — Pantry Host</title>
        <meta name="description" content="Weekly menus and curated meal plans for your kitchen." />
        <meta property="og:title" content="Menus — Pantry Host" />
        <meta property="og:description" content="Weekly menus and curated meal plans for your kitchen." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <MenusIndexPage initialData={initialData} />
    </>
  );
}
