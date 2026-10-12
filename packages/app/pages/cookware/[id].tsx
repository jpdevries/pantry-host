import { useRouter } from 'next/router';
import CookwareDetailPage, { type CookwareDetailData } from '@/components/pages/CookwareDetailPage';
import { isBrowser } from '@pantry-host/shared/env';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<CookwareDetailData>('/cookware/:id', ctx);
}

export default function CookwareDetail({ initialData }: PageDataProps<CookwareDetailData>) {
  const { id } = useRouter().query;
  const fallback = isBrowser ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '';
  return <CookwareDetailPage id={(id as string) || initialData?.cookwareItem?.id || fallback} initialData={initialData} />;
}
