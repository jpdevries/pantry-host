import { useRouter } from 'next/router';
import Head from 'next/head';
import MenuDetailPage, { MENU_QUERY, type Menu } from '@/components/pages/MenuDetailPage';
import { isBrowser } from '@pantry-host/shared/env';

interface Props {
  initialMenu?: Menu | null;
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
      body: JSON.stringify({ query: MENU_QUERY, variables: { id: params.slug } }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const snippet = (await res.text()).slice(0, 200);
      console.error('[menus/[slug]] GSSP non-OK response for slug=%s status=%d body=%s', params.slug, res.status, snippet);
      return { props: {} };
    }
    const body = (await res.json()) as { data?: { menu?: Menu | null }; errors?: unknown };
    if (body.errors) {
      console.error('[menus/[slug]] GSSP GraphQL errors for slug=%s: %s', params.slug, JSON.stringify(body.errors));
      return { props: {} };
    }
    const menu = body.data?.menu ?? null;
    if (!menu) {
      console.warn('[menus/[slug]] GSSP no menu matched slug=%s', params.slug);
      return { props: {} };
    }
    return { props: { initialMenu: menu } };
  } catch (e) {
    console.error(
      '[menus/[slug]] GSSP fetch failed for slug=%s: %s',
      params.slug,
      e instanceof Error ? (e.stack ?? e.message) : String(e),
    );
    return { props: {} };
  } finally {
    clearTimeout(timer);
  }
}

export default function MenuPage({ initialMenu }: Props) {
  const { slug } = useRouter().query;
  const fallback = isBrowser ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '';
  const menuId = (slug as string) || initialMenu?.slug || initialMenu?.id || fallback;

  const ogTitle = initialMenu?.title;
  const ogDescription = initialMenu?.description;
  const ogImage = initialMenu?.recipes?.find((mr) => mr.recipe.photoUrl)?.recipe.photoUrl ?? null;
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
      <MenuDetailPage menuId={menuId} initialMenu={initialMenu ?? null} />
    </>
  );
}
