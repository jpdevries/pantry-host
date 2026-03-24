import { useRouter } from 'next/router';
import RecipeExportPage from '@/components/pages/RecipeExportPage';
export default function KitchenExportRecipes() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  return <RecipeExportPage kitchen={(kitchen as string) || fallback} />;
}
