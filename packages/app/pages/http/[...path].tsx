/**
 * URL import page — self-hosted app (Rex).
 *
 * Catch-all for /http/*. Same logic as /https/* — delegates to the shared
 * UrlImportCommon component with scheme="http".
 */
import UrlImportCommon from '@/components/UrlImportCommon';

export default function HttpImportPage() {
  return (
    <main id="stage" className="max-sm:min-h-screen">
      <UrlImportCommon scheme="http" />
    </main>
  );
}
