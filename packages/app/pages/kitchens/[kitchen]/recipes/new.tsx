import { useRouter } from 'next/router';
import RecipeNewPage from '@/components/pages/RecipeNewPage';
export default function KitchenNewRecipe() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  return <RecipeNewPage kitchen={(kitchen as string) || fallback} />;
}
