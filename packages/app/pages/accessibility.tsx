import Head from 'next/head';
import AccessibilityPreferences from '@pantry-host/shared/components/AccessibilityPreferences';
export default function AccessibilityPage() {
  return (
    <>
      <Head>
        <title>Accessibility — Pantry Host</title>
        <meta name="description" content="Accessibility preferences — high contrast mode, reduced motion, and WCAG 2.1 Level AA commitment." />
        <meta property="og:title" content="Accessibility — Pantry Host" />
        <meta property="og:description" content="Accessibility preferences — high contrast mode, reduced motion, and WCAG 2.1 Level AA commitment." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <main id="stage" className="max-sm:min-h-screen">
        <AccessibilityPreferences />
      </main>
    </>
  );
}
