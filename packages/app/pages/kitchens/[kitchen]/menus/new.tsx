import { useRouter } from 'next/router';
import MenuNewPage from '@/components/pages/MenuNewPage';

export default function KitchenNewMenu() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  return <MenuNewPage kitchen={(kitchen as string) || fallback} />;
}
