import { useRouter } from 'next/router';
import Head from 'next/head';
import MenuDetailPage, { type Menu } from '@/components/pages/MenuDetailPage';
import { isBrowser } from '@pantry-host/shared/env';
import type { PageDataProps } from '@/lib/pageData';

export type MenuDetailData = { menu: Menu | null };

/** Shared by /menus/:slug and /kitchens/:kitchen/menus/:slug. */
export default function MenuDetailRoute({ initialData }: PageDataProps<MenuDetailData>) {
  const initialMenu = initialData?.menu ?? null;
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
      <MenuDetailPage menuId={menuId} initialMenu={initialMenu} />
    </>
  );
}
