import { useRouter } from 'next/router';
import MenuEditPage from '@/components/pages/MenuEditPage';
export default function EditMenuPage() {
  const { slug } = useRouter().query;
  return <MenuEditPage kitchen="home" menuId={(slug as string) || ''} />;
}
