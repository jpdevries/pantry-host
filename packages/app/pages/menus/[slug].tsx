import { useRouter } from 'next/router';
import Head from 'next/head';
import MenuDetailPage from '@/components/pages/MenuDetailPage';

interface Props {
  ogTitle?: string;
  ogDescription?: string;
}

// Bypass Rex 0.20.0's V8 SSR bug by going through the standalone GraphQL
// server (plain Node) instead of importing postgres.js into the SSR
// isolate. See packages/app/pages/recipes/[slug].tsx for full context.
export async function getServerSideProps({ params }: { params: { slug: string } }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch('http://localhost:4001/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query($id:String!){menu(id:$id){title description}}',
        variables: { id: params.slug },
      }),
      signal: controller.signal,
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { menu?: { title?: string; description?: string } } };
      const row = body.data?.menu;
      if (row) {
        return {
          props: {
            ogTitle: row.title ?? null,
            ogDescription: row.description ?? null,
          },
        };
      }
    }
  } catch { /* GraphQL unavailable / timed out — render without og tags */ }
  finally { clearTimeout(timer); }
  return { props: {} };
}

export default function MenuPage({ ogTitle, ogDescription }: Props) {
  const { slug } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '';
  const title = ogTitle ? `${ogTitle} — Pantry Host` : 'Menus — Pantry Host';
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        {ogDescription && <meta property="og:description" content={ogDescription} />}
        {ogDescription && <meta name="description" content={ogDescription} />}
        <meta name="twitter:card" content="summary" />
      </Head>
      <MenuDetailPage kitchen="home" menuId={(slug as string) || fallback} />
    </>
  );
}
