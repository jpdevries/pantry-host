import { useRouter } from 'next/router';
import MenuEditPage from '@/components/pages/MenuEditPage';
import { isBrowser } from '@pantry-host/shared/env';

export default function KitchenEditMenu() {
  const { slug } = useRouter().query;
  const segments = isBrowser ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/menus/[slug]/edit
  return <MenuEditPage menuId={(slug as string) || segments[3] || ''} />;
}
