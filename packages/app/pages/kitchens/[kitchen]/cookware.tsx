import { useRouter } from 'next/router';
import CookwarePage from '@/components/pages/CookwarePage';
export default function KitchenCookware() {
  const { kitchen } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : ''; // /kitchens/[kitchen]/cookware
  return <CookwarePage kitchen={(kitchen as string) || fallback} />;
}
