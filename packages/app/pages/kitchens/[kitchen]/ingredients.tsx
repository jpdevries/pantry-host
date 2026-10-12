import IngredientsPage, { type IngredientsIndexData } from '@/components/pages/IngredientsPage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<IngredientsIndexData>('/kitchens/:kitchen/ingredients', ctx);
}

export default function KitchenIngredients({ initialData }: PageDataProps<IngredientsIndexData>) {
  return <IngredientsPage initialData={initialData} />;
}
