import { Link, useParams } from 'react-router-dom';
import PantryReview from '@pantry-host/shared/components/PantryReview';
import { gql } from '@/lib/gql';

/** /ingredients/review and /kitchens/:kitchen/ingredients/review. Everything
 *  is local in the browser tier, so the user can always edit. */
/** localStorage key that mirrors REVIEW_CONFIRM_DESTRUCTIVE (the shared
 *  SettingsPage kebab-cases schema keys). */
const CONFIRM_KEY = 'review-confirm-destructive';

export default function PantryReviewPage() {
  const kitchen = useParams<{ kitchen?: string }>().kitchen ?? 'home';
  let confirmDestructive = false;
  try { confirmDestructive = localStorage.getItem(CONFIRM_KEY) === 'true'; } catch { /* private mode */ }
  return (
    <PantryReview
      gql={gql}
      kitchenSlug={kitchen}
      pantryHref={`/kitchens/${kitchen}/ingredients`}
      canEdit
      confirmDestructive={confirmDestructive}
      renderLink={({ href, className, children }) => <Link to={href} className={className}>{children}</Link>}
    />
  );
}
