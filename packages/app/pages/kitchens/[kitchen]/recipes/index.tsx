import RecipesIndexPage, { type RecipesIndexData } from '@/components/pages/RecipesIndexPage';
import { getPageData, type PageDataContext, type PageDataProps } from '@/lib/pageData';

export async function getServerSideProps(ctx: PageDataContext) {
  return getPageData<RecipesIndexData>('/kitchens/:kitchen/recipes', ctx);
}

export default function KitchenRecipes({ initialData, query }: PageDataProps<RecipesIndexData>) {
  return <RecipesIndexPage initialData={initialData} query={query} />;
}
