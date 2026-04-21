import Head from 'next/head';
import { useRouter } from 'next/router';
import BlueskyFeedsPage from '@/components/pages/BlueskyFeedsPage';

export default function KitchenBlueskyFeedsRoute() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  return (
    <>
      <Head><title>Bluesky Recipes — Pantry Host</title></Head>
      <BlueskyFeedsPage kitchen={(kitchen as string) || fallback} />
    </>
  );
}
