import { useRouter } from 'next/router';
import RecipeEditPage from '@/components/pages/RecipeEditPage';
import { isBrowser } from '@pantry-host/shared/env';
export default function KitchenEditRecipe() {
  const { slug } = useRouter().query;
  const segments = isBrowser ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/recipes/[slug]/edit
  return <RecipeEditPage recipeId={(slug as string) || segments[3] || ''} />;
}
