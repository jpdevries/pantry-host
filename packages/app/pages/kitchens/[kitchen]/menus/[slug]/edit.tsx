import { useRouter } from 'next/router';
import MenuEditPage from '@/components/pages/MenuEditPage';

export default function KitchenEditMenu() {
  const { kitchen, slug } = useRouter().query;
  const segments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/menus/[slug]/edit
  return <MenuEditPage kitchen={(kitchen as string) || segments[1] || ''} menuId={(slug as string) || segments[3] || ''} />;
}
