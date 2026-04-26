import { useRouter } from 'next/router';
import RecipeEditPage from '@/components/pages/RecipeEditPage';
import { isBrowser } from '@pantry-host/shared/env';
export default function EditRecipePage() {
  const { slug } = useRouter().query;
  const segments = isBrowser ? window.location.pathname.split('/').filter(Boolean) : [];
  const fallback = segments[segments.length - 2] || ''; // /recipes/[slug]/edit → slug is second-to-last
  return <RecipeEditPage recipeId={(slug as string) || fallback} />;
}
