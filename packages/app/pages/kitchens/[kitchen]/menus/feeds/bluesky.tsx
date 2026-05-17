import Head from 'next/head';
import BlueskyMenuFeedsPage from '@/components/pages/BlueskyMenuFeedsPage';

export default function KitchenBlueskyMenuFeedsRoute() {
  return (
    <>
      <Head><title>Bluesky Menus — Pantry Host</title></Head>
      <BlueskyMenuFeedsPage />
    </>
  );
}
