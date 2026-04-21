import { useState, useEffect } from 'react';
import AtImportPage from '@/components/pages/AtImportPage';

/** Kitchen-scoped /kitchens/:kitchen/at/* — imports land in the named
 *  kitchen. Parallel of the top-level /at/* route; they share the same
 *  `AtImportPage` component. Rex's useRouter().query is unreliable in
 *  prod builds (gotcha #9), so we parse the pathname directly. */
export default function KitchenAtRoute() {
  const [parts, setParts] = useState<{ kitchen: string; wildcard: string } | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const match = window.location.pathname.match(/^\/kitchens\/([^/]+)\/at\/(.+)$/);
    if (match) {
      setParts({ kitchen: match[1], wildcard: match[2] });
    } else {
      setParts({ kitchen: 'home', wildcard: '' });
    }
  }, []);
  if (!parts) return null;
  return <AtImportPage wildcard={parts.wildcard} kitchen={parts.kitchen} />;
}
