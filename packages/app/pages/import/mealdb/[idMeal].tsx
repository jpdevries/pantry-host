import { useState, useEffect } from 'react';
import MealdbImportPage from '@/components/pages/MealdbImportPage';
import { isServer } from '@pantry-host/shared/env';

/** Top-level `/import/mealdb/{idMeal}` route. Imports land in the
 *  `home` kitchen by default, mirroring the `/at/*` alias. */
export default function MealdbImportRoute() {
  const [idMeal, setIdMeal] = useState<string | null>(null);
  useEffect(() => {
    if (isServer) return;
    const match = window.location.pathname.match(/^\/import\/mealdb\/([^/?#]+)/);
    setIdMeal(match ? decodeURIComponent(match[1]) : '');
  }, []);
  if (idMeal === null) return null;
  if (!idMeal) {
    return <div className="max-w-3xl mx-auto py-12 px-4">Missing recipe id.</div>;
  }
  return <MealdbImportPage idMeal={idMeal} />;
}
