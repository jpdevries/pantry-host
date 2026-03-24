import { useRouter } from 'next/router';
import RecipeDetailPage from '@/components/pages/RecipeDetailPage';
export default function KitchenRecipeDetail() {
  const { kitchen, slug } = useRouter().query;
  const segments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/recipes/[slug]
  return <RecipeDetailPage kitchen={(kitchen as string) || segments[1] || ''} recipeId={(slug as string) || segments[3] || ''} />;
}
