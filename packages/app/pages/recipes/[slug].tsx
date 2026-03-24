import { useRouter } from 'next/router';
import RecipeDetailPage from '@/components/pages/RecipeDetailPage';
export default function RecipePage() {
  const { slug } = useRouter().query;
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean).pop() || '' : '';
  return <RecipeDetailPage kitchen="home" recipeId={(slug as string) || fallback} />;
}
