import { useRouter } from 'next/router';
import GroceryListPage from '@/components/pages/GroceryListPage';
export default function KitchenList() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  return <GroceryListPage kitchen={(kitchen as string) || fallback} />;
}
