import { useState, useEffect } from 'react';
import AtImportPage from '@/components/pages/AtImportPage';

/** Kitchen-scoped /kitchens/:kitchen/at/* — imports land in the named
 *  kitchen. Parallel of the top-level /at/* route; they share the same
 *  `AtImportPage` component, which reads the active kitchen from
 *  `useKitchen()`. Rex's useRouter().query is unreliable in prod builds
 *  (gotcha #9), so we parse the wildcard from the pathname directly. */
export default function KitchenAtRoute() {
  const [wildcard, setWildcard] = useState<string | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const match = window.location.pathname.match(/^\/kitchens\/[^/]+\/at\/(.+)$/);
    setWildcard(match ? match[1] : '');
  }, []);
  if (wildcard === null) return null;
  return <AtImportPage wildcard={wildcard} />;
}
