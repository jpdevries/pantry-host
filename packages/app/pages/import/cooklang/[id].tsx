import { useState, useEffect } from 'react';
import CooklangImportPage from '@/components/pages/CooklangImportPage';
import { isServer } from '@pantry-host/shared/env';

export default function CooklangImportRoute() {
  const [id, setId] = useState<string | null>(null);
  useEffect(() => {
    if (isServer) return;
    const match = window.location.pathname.match(/^\/import\/cooklang\/([^/?#]+)/);
    setId(match ? decodeURIComponent(match[1]) : '');
  }, []);
  if (id === null) return null;
  if (!id) return <div className="max-w-3xl mx-auto py-12 px-4">Missing recipe id.</div>;
  return <CooklangImportPage id={id} />;
}
