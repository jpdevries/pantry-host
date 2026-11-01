import { Link, useParams } from 'react-router-dom';
import PantryReview from '@pantry-host/shared/components/PantryReview';
import { gql } from '@/lib/gql';

/** /ingredients/review and /kitchens/:kitchen/ingredients/review. Everything
 *  is local in the browser tier, so the user can always edit. */
export default function PantryReviewPage() {
  const kitchen = useParams<{ kitchen?: string }>().kitchen ?? 'home';
  return (
    <PantryReview
      gql={gql}
      kitchenSlug={kitchen}
      pantryHref={`/kitchens/${kitchen}/ingredients`}
      canEdit
      renderLink={({ href, className, children }) => <Link to={href} className={className}>{children}</Link>}
    />
  );
}
