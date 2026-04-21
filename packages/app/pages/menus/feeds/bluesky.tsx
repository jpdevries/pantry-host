import Head from 'next/head';
import BlueskyMenuFeedsPage from '@/components/pages/BlueskyMenuFeedsPage';

export default function BlueskyMenuFeedsRoute() {
  return (
    <>
      <Head><title>Bluesky Menus — Pantry Host</title></Head>
      <BlueskyMenuFeedsPage />
    </>
  );
}
