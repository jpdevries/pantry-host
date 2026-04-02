import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Nav from '@/components/Nav';
import OfflineBanner from '@/components/OfflineBanner';
import Footer from '@pantry-host/shared/components/Footer';
import { flush } from '@/lib/offlineQueue';
import { registerFlush } from '@/lib/apiStatus';
import { initTheme } from '@pantry-host/shared/theme';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      const buildHash = document.querySelector<HTMLMetaElement>('meta[name="build-hash"]')?.content || 'dev';
      navigator.serviceWorker.register(`/sw.js?v=${buildHash}`).catch(console.error);
    }
    initTheme();
    // Flush is triggered by API coming back online, not navigator.online —
    // so it works when returning home from the grocery store (5G → home wifi)
    registerFlush(flush);
    // Flush any mutations queued while offline on startup
    flush().catch(console.error);

    // TODO: Remove this workaround when Rex fixes SSR with React 19.
    // When SSR fails (prod mode), the browser can't resolve #hash anchors
    // against the empty document. Re-scroll to the hash target after hydration.
    if (window.location.hash) {
      const id = window.location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      } else {
        // Element may not exist yet (data still loading). Retry briefly.
        const t = setTimeout(() => {
          document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
        }, 300);
        return () => clearTimeout(t);
      }
    }
  }, []);

  return (
    <>
      <Nav />
      <OfflineBanner />
      <Component {...pageProps} />
      <Footer />
    </>
  );
}
