import Head from 'next/head';
import CookwarePageComponent from '@/components/pages/CookwarePage';
export default function CookwarePage() {
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
      <CookwarePageComponent />
    </>
  );
}
