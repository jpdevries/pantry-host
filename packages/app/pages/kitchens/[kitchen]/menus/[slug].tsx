import MenuDetailRoute, { type MenuDetailData } from '@/components/routes/MenuDetailRoute';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<MenuDetailData>('/kitchens/:kitchen/menus/:slug', ctx);
}

export default function KitchenMenuPage({ initialData }: PageDataProps<MenuDetailData>) {
  return <MenuDetailRoute initialData={initialData} />;
}
