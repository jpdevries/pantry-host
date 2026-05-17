import { useRouter } from 'next/router';
import CookwareDetailPage from '@/components/pages/CookwareDetailPage';
import { isBrowser } from '@pantry-host/shared/env';

export default function KitchenCookwareDetail() {
  const { id } = useRouter().query;
  const segments = isBrowser ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/cookware/[id]
  return <CookwareDetailPage id={(id as string) || segments[3] || ''} />;
}
