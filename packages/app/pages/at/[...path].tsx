import { useState, useEffect } from 'react';
import AtImportPage from '@/components/pages/AtImportPage';

/** Top-level /at/* alias. Imports land in the `home` kitchen by default
 *  (mirror of how `/` aliases to `/kitchens/home`). Users who want a
 *  specific kitchen navigate via `/kitchens/{slug}/at/{...}`. */
export default function AtTopLevelRoute() {
  const [wildcard, setWildcard] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const match = window.location.pathname.match(/^\/at\/(.+)$/);
    setWildcard(match ? match[1] : '');
  }, []);
  if (wildcard === null) return null;
  return <AtImportPage wildcard={wildcard} />;
}
