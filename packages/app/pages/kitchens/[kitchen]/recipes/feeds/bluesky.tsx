import Head from 'next/head';
import BlueskyFeedsPage from '@/components/pages/BlueskyFeedsPage';

export default function KitchenBlueskyFeedsRoute() {
  return (
    <>
      <Head><title>Bluesky Recipes — Pantry Host</title></Head>
      <BlueskyFeedsPage />
    </>
  );
}
