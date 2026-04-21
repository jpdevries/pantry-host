import HomePage from '@/components/pages/HomePage';

/** Per-kitchen dashboard. The same HomePage also renders at the
 *  top-level `/` alias — both URLs are real. The active kitchen is
 *  read via `useKitchen()` inside HomePage; this wrapper doesn't need
 *  to resolve it. */
export default function KitchenDashboard() {
  return <HomePage />;
}
