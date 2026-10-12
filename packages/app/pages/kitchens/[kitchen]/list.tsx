import GroceryListPage, { type GroceryListData } from '@/components/pages/GroceryListPage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<GroceryListData>('/kitchens/:kitchen/list', ctx);
}

export default function KitchenList({ initialData }: PageDataProps<GroceryListData>) {
  return <GroceryListPage initialData={initialData} />;
}
