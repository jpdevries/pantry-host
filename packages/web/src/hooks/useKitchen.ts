import { useParams } from 'react-router-dom';

/** Returns the current kitchen slug from the URL, defaulting to 'home'. */
export function useKitchen(): string {
  const { kitchen } = useParams<{ kitchen?: string }>();
  return kitchen ?? 'home';
}

/**
 * Build a path that stays within the current kitchen context.
 * Top-level routes (home kitchen) stay as `/path`.
 * Kitchen-scoped routes become `/kitchens/{slug}/path`.
 */
export function useKitchenHref(path: string): string {
  const kitchen = useKitchen();
  return kitchen === 'home' ? path : `/kitchens/${kitchen}${path}`;
}
