import { useRouter } from 'next/router';
import CookwareDetailPage from '@/components/pages/CookwareDetailPage';

export default function CookwareDetail() {
  const { id } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '';
  return <CookwareDetailPage id={(id as string) || fallback} />;
}
