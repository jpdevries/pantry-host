import { useState, useEffect } from 'react';
import AtImportPage from '@/components/pages/AtImportPage';
import { isServer } from '@pantry-host/shared/env';

/** Top-level /at/* alias. Imports land in the `home` kitchen by default
 *  (mirror of how `/` aliases to `/kitchens/home`). Users who want a
 *  specific kitchen navigate via `/kitchens/{slug}/at/{...}`. */
export default function AtTopLevelRoute() {
  const [wildcard, setWildcard] = useState<string | null>(null);
  useEffect(() => {
    if (isServer) return;
    const match = window.location.pathname.match(/^\/at\/(.+)$/);
    setWildcard(match ? match[1] : '');
  }, []);
  return (
    <main id="stage" className="max-sm:min-h-screen">
      {wildcard !== null && <AtImportPage wildcard={wildcard} />}
    </main>
  );
}
