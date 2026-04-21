import { useRouter } from 'next/router';
import RecipeDetailPage from '@/components/pages/RecipeDetailPage';
export default function KitchenRecipeDetail() {
  const { slug } = useRouter().query;
  const segments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/recipes/[slug]
  return <RecipeDetailPage recipeId={(slug as string) || segments[3] || ''} />;
}
