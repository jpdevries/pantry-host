import { useRouter } from 'next/router';
import RecipesIndexPage from '@/components/pages/RecipesIndexPage';
export default function KitchenRecipes() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  return <RecipesIndexPage kitchen={(kitchen as string) || fallback} />;
}
