import Head from 'next/head';
import MenusIndexPage from '@/components/pages/MenusIndexPage';
export default function MenusPage() {
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
      <MenusIndexPage />
    </>
  );
}
