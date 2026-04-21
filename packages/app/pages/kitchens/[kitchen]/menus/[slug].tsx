import { useRouter } from 'next/router';
import Head from 'next/head';
import MenuDetailPage from '@/components/pages/MenuDetailPage';

interface Props {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

// Mirror of packages/app/pages/menus/[slug].tsx — fetches og tags via
// the standalone GraphQL server (Rex 0.20.0 SSR can't run postgres.js
// in its V8 isolate).
export async function getServerSideProps({ params }: { params: { slug: string } }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch('http://localhost:4001/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query($id:String!){menu(id:$id){title description recipes{photoUrl}}}',
        variables: { id: params.slug },
      }),
      signal: controller.signal,
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { menu?: { title?: string; description?: string; recipes?: { photoUrl?: string }[] } } };
      const row = body.data?.menu;
      if (row) {
        const firstPhoto = row.recipes?.find((r) => r.photoUrl)?.photoUrl ?? null;
        return {
          props: {
            ogTitle: row.title ?? null,
            ogDescription: row.description ?? null,
            ogImage: firstPhoto,
          },
        };
      }
    }
  } catch { /* GraphQL unavailable / timed out — render without og tags */ }
  finally { clearTimeout(timer); }
  return { props: {} };
}

export default function KitchenMenuPage({ ogTitle, ogDescription, ogImage }: Props) {
  const { slug } = useRouter().query;
  const segments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/menus/[slug]
  const title = ogTitle ? `${ogTitle} — Pantry Host` : 'Menus — Pantry Host';
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="website" />
        {ogDescription && <meta property="og:description" content={ogDescription} />}
        {ogDescription && <meta name="description" content={ogDescription} />}
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
      </Head>
      <MenuDetailPage menuId={(slug as string) || segments[3] || ''} />
    </>
  );
}
