import { useEffect } from 'react';
import { useRouter } from 'next/router';
import HomePage from '@/components/pages/HomePage';

/** Per-kitchen dashboard. Home kitchen has one canonical URL (`/`), so
 *  `/kitchens/home` redirects there — without a redirect both URLs would
 *  render the same content and confuse bookmarks, SEO, and the switcher's
 *  "current" highlight. */
export default function KitchenDashboard() {
  const { kitchen } = useRouter().query;
  // Rex's router `query` is unreliable in prod builds on dynamic routes
  // (gotcha #9 in CLAUDE.md) — fall back to parsing the pathname so the
  // kitchen slug always resolves.
  const fallback = typeof window !== 'undefined' ? window.location.pathname.split('/').filter(Boolean)[1] || '' : '';
  const slug = (kitchen as string) || fallback;

  useEffect(() => {
    if (slug === 'home' && typeof window !== 'undefined') {
      window.location.replace('/#stage');
    }
  }, [slug]);

  // Render nothing during the brief redirect to avoid a flash of Home content
  // at `/kitchens/home` before the replace() fires.
  if (slug === 'home') return null;

  return <HomePage kitchen={slug} />;
}
