import RecipeDetailRoute, { type RecipeDetailData } from '@/components/routes/RecipeDetailRoute';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<RecipeDetailData>('/kitchens/:kitchen/recipes/:slug', ctx);
}

export default function KitchenRecipeDetail({ initialData }: PageDataProps<RecipeDetailData>) {
  return <RecipeDetailRoute initialData={initialData} />;
}
