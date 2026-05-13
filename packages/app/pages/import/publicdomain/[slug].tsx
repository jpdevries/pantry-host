import { useState, useEffect } from 'react';
import PublicDomainImportPage from '@/components/pages/PublicDomainImportPage';
import { isServer } from '@pantry-host/shared/env';

export default function PublicDomainImportRoute() {
  const [slug, setSlug] = useState<string | null>(null);
  useEffect(() => {
    if (isServer) return;
    const match = window.location.pathname.match(/^\/import\/publicdomain\/([^/?#]+)/);
    setSlug(match ? decodeURIComponent(match[1]) : '');
  }, []);
  if (slug === null) return null;
  if (!slug) return <div className="max-w-3xl mx-auto py-12 px-4">Missing recipe slug.</div>;
  return <PublicDomainImportPage slug={slug} />;
}
