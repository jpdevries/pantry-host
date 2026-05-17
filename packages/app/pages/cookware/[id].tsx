import { useRouter } from 'next/router';
import CookwareDetailPage from '@/components/pages/CookwareDetailPage';
import { isBrowser } from '@pantry-host/shared/env';

export default function CookwareDetail() {
  const { id } = useRouter().query;
  const fallback = isBrowser ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '';
  return <CookwareDetailPage id={(id as string) || fallback} />;
}
