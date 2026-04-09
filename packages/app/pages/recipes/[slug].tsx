import { useRouter } from 'next/router';
import Head from 'next/head';
import RecipeDetailPage from '@/components/pages/RecipeDetailPage';

interface Props {
  ogTitle?: string;
  ogDescription?: string;
  ogImage?: string;
}

// Rex 0.20.0 has a recurring V8 SSR bug where postgres.js native sockets
// inside getServerSideProps deadlock the microtask checkpoint and brick
// the page. Bypass it by going through the standalone GraphQL server
// (plain Node, no V8 isolate) over HTTP. AbortController + 2s budget
// guarantees we never block the page render even if GraphQL is down.
export async function getServerSideProps({ params }: { params: { slug: string } }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch('http://localhost:4001/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: 'query($id:String!){recipe(id:$id){title description photoUrl}}',
        variables: { id: params.slug },
      }),
      signal: controller.signal,
    });
    if (res.ok) {
      const body = (await res.json()) as { data?: { recipe?: { title?: string; description?: string; photoUrl?: string } } };
      const row = body.data?.recipe;
      if (row) {
        return {
          props: {
            ogTitle: row.title ?? null,
            ogDescription: row.description ?? null,
            ogImage: row.photoUrl ?? null,
          },
        };
      }
    }
  } catch { /* GraphQL unavailable / timed out — render without og tags */ }
  finally { clearTimeout(timer); }
  return { props: {} };
}

export default function RecipePage({ ogTitle, ogDescription, ogImage }: Props) {
  const { slug } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '';
  const title = ogTitle ? `${ogTitle} — Pantry Host` : 'Pantry Host';
  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="article" />
        {ogDescription && <meta property="og:description" content={ogDescription} />}
        {ogDescription && <meta name="description" content={ogDescription} />}
        {ogImage && <meta property="og:image" content={ogImage} />}
        <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
      </Head>
      <RecipeDetailPage kitchen="home" recipeId={(slug as string) || fallback} />
    </>
  );
}
