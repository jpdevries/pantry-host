import { useRouter } from 'next/router';
import RecipeEditPage from '@/components/pages/RecipeEditPage';
export default function KitchenEditRecipe() {
  const { kitchen, slug } = useRouter().query;
  const segments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/recipes/[slug]/edit
  return <RecipeEditPage kitchen={(kitchen as string) || segments[1] || ''} recipeId={(slug as string) || segments[3] || ''} />;
}
