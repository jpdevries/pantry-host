import { useRouter } from 'next/router';
import MenuEditPage from '@/components/pages/MenuEditPage';
export default function EditMenuPage() {
  const { slug } = useRouter().query;
  const segments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
  const fallback = segments[segments.length - 2] || ''; // /menus/[slug]/edit → slug is second-to-last
  return <MenuEditPage menuId={(slug as string) || fallback} />;
}
