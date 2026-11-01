import Head from 'next/head';
import { useEffect, useState } from 'react';
import PantryReview from '@pantry-host/shared/components/PantryReview';
import { gql } from '@/lib/gql';
import { useKitchen } from '@/lib/kitchen-context';
import { isOwner } from '@/lib/isTrustedNetwork';

/**
 * /ingredients/review and /kitchens/:kitchen/ingredients/review.
 *
 * Client-fetched (no server seed): the findings depend on "now", so a
 * server render would disagree with the first client render. The shared
 * component is `data-requires-js`; the lite fallback hides it.
 */
export default function PantryReviewPage() {
  const kitchen = useKitchen();
  const [canEdit, setCanEdit] = useState(false);
  useEffect(() => { setCanEdit(isOwner()); }, []);
  return (
    <>
      <Head>
        <title>Pantry Review — Pantry Host</title>
        <meta name="description" content="Expired, expiring, stale, duplicate and out-of-stock pantry items, reconciled in bulk." />
      </Head>
      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-4xl mx-auto">
        <PantryReview
          gql={gql}
          kitchenSlug={kitchen}
          pantryHref={`/kitchens/${kitchen}/ingredients#stage`}
          canEdit={canEdit}
        />
      </main>
    </>
  );
}
