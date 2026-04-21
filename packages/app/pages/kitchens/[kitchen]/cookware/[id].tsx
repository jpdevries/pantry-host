import { useRouter } from 'next/router';
import CookwareDetailPage from '@/components/pages/CookwareDetailPage';

export default function KitchenCookwareDetail() {
  const { id } = useRouter().query;
  const segments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : []; // /kitchens/[kitchen]/cookware/[id]
  return <CookwareDetailPage id={(id as string) || segments[3] || ''} />;
}
