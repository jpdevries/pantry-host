import RecipesIndexPage from '@/components/pages/RecipesIndexPage';
import { getRecipesIndexProps, type RecipesIndexProps } from '@/lib/recipesIndexProps';

export async function getServerSideProps({ params }: { params: { kitchen: string } }) {
  return getRecipesIndexProps(params.kitchen);
}

export default function KitchenRecipes({ initialRecipes }: RecipesIndexProps) {
  return <RecipesIndexPage initialRecipes={initialRecipes} />;
}
