import { useState, useEffect } from 'react';
import CocktaildbImportPage from '@/components/pages/CocktaildbImportPage';
import { isServer } from '@pantry-host/shared/env';

export default function CocktaildbImportRoute() {
  const [idDrink, setIdDrink] = useState<string | null>(null);
  useEffect(() => {
    if (isServer) return;
    const match = window.location.pathname.match(/^\/import\/cocktaildb\/([^/?#]+)/);
    setIdDrink(match ? decodeURIComponent(match[1]) : '');
  }, []);
  if (idDrink === null) return null;
  if (!idDrink) return <div className="max-w-3xl mx-auto py-12 px-4">Missing drink id.</div>;
  return <CocktaildbImportPage idDrink={idDrink} />;
}
