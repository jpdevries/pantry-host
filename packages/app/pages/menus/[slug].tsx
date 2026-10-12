import MenuDetailRoute, { type MenuDetailData } from '@/components/routes/MenuDetailRoute';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<MenuDetailData>('/menus/:slug', ctx);
}

export default function MenuPage({ initialData }: PageDataProps<MenuDetailData>) {
  return <MenuDetailRoute initialData={initialData} />;
}
