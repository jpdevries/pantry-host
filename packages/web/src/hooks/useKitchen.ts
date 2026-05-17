import { useParams } from 'react-router-dom';

/** Returns the current kitchen slug from the URL. Top-level routes like
 *  `/`, `/recipes`, `/at/*` are friendly aliases with no `:kitchen`
 *  param — they default to `'home'`, which is a real kitchen slug like
 *  any other. Internal links should always build `/kitchens/${slug}/…`
 *  paths, not branch on the slug value. */
export function useKitchen(): string {
  const { kitchen } = useParams<{ kitchen?: string }>();
  return kitchen ?? 'home';
}

/** Build a kitchen-scoped path. Always `/kitchens/{slug}{path}` — the
 *  home kitchen is not a structural special case. The top-level
 *  aliases (`/`, `/recipes`, …) still work because their routes are
 *  registered separately; this helper just stops components from
 *  manufacturing them as internal links. */
export function useKitchenHref(path: string): string {
  const kitchen = useKitchen();
  return `/kitchens/${kitchen}${path}`;
}
