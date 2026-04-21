import Head from 'next/head';
import { useRouter } from 'next/router';
import BlueskyMenuFeedsPage from '@/components/pages/BlueskyMenuFeedsPage';

export default function KitchenBlueskyMenuFeedsRoute() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  return (
    <>
      <Head><title>Bluesky Menus — Pantry Host</title></Head>
      <BlueskyMenuFeedsPage kitchen={(kitchen as string) || fallback} />
    </>
  );
}
