import { useRouter } from 'next/router';
import HomePage from '@/components/pages/HomePage';

/** Per-kitchen dashboard. The same HomePage component also renders at
 *  the top-level `/` alias with `kitchen="home"` hardcoded — both
 *  URLs are real and render the same content. No redirect. */
export default function KitchenDashboard() {
  const { kitchen } = useRouter().query;
  // Rex's router `query` is unreliable in prod builds on dynamic routes
  // (gotcha #9 in CLAUDE.md) — fall back to parsing the pathname so the
  // kitchen slug always resolves.
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  const slug = (kitchen as string) || fallback || 'home';
  return <HomePage kitchen={slug} />;
}
