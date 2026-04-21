import { useRouter } from 'next/router';
import RecipeEditPage from '@/components/pages/RecipeEditPage';
export default function EditRecipePage() {
  const { slug } = useRouter().query;
  const segments = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean) : [];
  const fallback = segments[segments.length - 2] || ''; // /recipes/[slug]/edit → slug is second-to-last
  return <RecipeEditPage recipeId={(slug as string) || fallback} />;
}
