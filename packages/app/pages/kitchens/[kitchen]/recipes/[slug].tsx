import { useRouter } from 'next/router';
import RecipeDetailPage from '@/components/pages/RecipeDetailPage';
import { isBrowser } from '@pantry-host/shared/env';
export default function KitchenRecipeDetail() {
  const { slug } = useRouter().query;
  const segments = isBrowser ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/recipes/[slug]
  return <RecipeDetailPage recipeId={(slug as string) || segments[3] || ''} />;
}
