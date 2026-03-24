import { useRouter } from 'next/router';
import RecipeImportPage from '@/components/pages/RecipeImportPage';
export default function KitchenImportRecipes() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  return <RecipeImportPage kitchen={(kitchen as string) || fallback} />;
}
