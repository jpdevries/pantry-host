import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Nav from '@/components/Nav';
import OfflineBanner from '@/components/OfflineBanner';
import Footer from '@/components/Footer';
import { flush } from '@/lib/offlineQueue';
import { registerFlush } from '@/lib/apiStatus';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(console.error);
    }
    // Flush is triggered by API coming back online, not navigator.online —
    // so it works when returning home from the grocery store (5G → home wifi)
    registerFlush(flush);
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
