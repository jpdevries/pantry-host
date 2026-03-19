import { useRouter } from 'next/router';
import MenuDetailPage from '@/components/pages/MenuDetailPage';
export default function MenuPage() {
  const { slug } = useRouter().query;
  return <MenuDetailPage kitchen="home" menuId={(slug as string) || ''} />;
}
