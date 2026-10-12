import CookwarePage, { type CookwareIndexData } from '@/components/pages/CookwarePage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<CookwareIndexData>('/kitchens/:kitchen/cookware', ctx);
}

export default function KitchenCookware({ initialData }: PageDataProps<CookwareIndexData>) {
  return <CookwarePage initialData={initialData} />;
}
