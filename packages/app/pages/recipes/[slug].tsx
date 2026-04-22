import { useRouter } from 'next/router';
import Head from 'next/head';
import RecipeDetailPage, { RECIPE_QUERY, type Recipe } from '@/components/pages/RecipeDetailPage';

interface Props {
  initialRecipe?: Recipe | null;
}

// Rex 0.20.0 has a recurring V8 SSR bug where postgres.js native sockets
// inside getServerSideProps deadlock the microtask checkpoint and brick
// the page. Bypass it by going through the standalone GraphQL server
// (plain Node, no V8 isolate) over HTTP. AbortController + 5s budget
// guarantees we never block the page render even if GraphQL is down.
//
// Rex's V8 fetch polyfill has SSRF protection that blocks every private /
// loopback address by default. To permit this in-process call to the local
// GraphQL server, the Rex process must be started with
//   REX_INTERNAL_ORIGIN=http://127.0.0.1:4001
// (see crates/rex_v8/src/fetch.rs). The URL below must share that prefix.
export async function getServerSideProps({ params }: { params: { slug: string } }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch('http://127.0.0.1:4001/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: RECIPE_QUERY, variables: { id: params.slug } }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const snippet = (await res.text()).slice(0, 200);
      console.error('[recipes/[slug]] GSSP non-OK response for slug=%s status=%d body=%s', params.slug, res.status, snippet);
      return { props: {} };
    }
    const body = (await res.json()) as { data?: { recipe?: Recipe | null }; errors?: unknown };
    if (body.errors) {
      console.error('[recipes/[slug]] GSSP GraphQL errors for slug=%s: %s', params.slug, JSON.stringify(body.errors));
      return { props: {} };
    }
    const recipe = body.data?.recipe ?? null;
    if (!recipe) {
      console.warn('[recipes/[slug]] GSSP no recipe matched slug=%s', params.slug);
      return { props: {} };
    }
    return { props: { initialRecipe: recipe } };
  } catch (e) {
    console.error(
      '[recipes/[slug]] GSSP fetch failed for slug=%s: %s',
      params.slug,
      e instanceof Error ? (e.stack ?? e.message) : String(e),
    );
    return { props: {} };
  } finally {
    clearTimeout(timer);
  }
}

export default function RecipePage({ initialRecipe }: Props) {
  const { slug } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '';
  const recipeId = (slug as string) || initialRecipe?.slug || initialRecipe?.id || fallback;

  const ogTitle = initialRecipe?.title;
  const ogDescription = initialRecipe?.description;
  const ogImage = initialRecipe?.photoUrl;
  const title = ogTitle ? `${ogTitle} — Pantry Host` : 'Pantry Host';

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta property="og:title" content={title} />
        <meta property="og:type" content="article" />
        {ogDescription && <meta property="og:description" content={ogDescription} />}
        {ogDescription && <meta name="description" content={ogDescription} />}
        {ogImage && <meta key="og:image" property="og:image" content={ogImage} />}
        <meta name="twitter:card" content={ogImage ? 'summary_large_image' : 'summary'} />
      </Head>
      <RecipeDetailPage recipeId={recipeId} initialRecipe={initialRecipe ?? null} />
    </>
  );
}
