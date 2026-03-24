import { useRouter } from 'next/router';
import IngredientsPage from '@/components/pages/IngredientsPage';
export default function KitchenIngredients() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  return <IngredientsPage kitchen={(kitchen as string) || fallback} />;
}
