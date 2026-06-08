/**
 * URL import page — self-hosted app (Rex).
 *
 * Catch-all for /https/*. Parses the URL from window.location.pathname
 * (Rex's useRouter().query is unreliable in prod — gotcha #9), scrapes
 * the page via the local fetch-recipe API, and renders the shared
 * UrlRecipeDetail preview.
 */
import UrlImportCommon from '@/components/UrlImportCommon';

export default function HttpsImportPage() {
  return (
    <main id="stage" className="max-sm:min-h-screen">
      <UrlImportCommon scheme="https" />
    </main>
  );
}
