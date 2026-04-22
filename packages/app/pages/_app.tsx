import { useEffect } from 'react';
import type { AppProps } from 'next/app';
import Head from 'next/head';
import Nav from '@/components/Nav';
import OfflineBanner from '@/components/OfflineBanner';
import { KitchenProvider } from '@/lib/kitchen-context';
import Footer from '@pantry-host/shared/components/Footer';
import { flush } from '@/lib/offlineQueue';
import { registerFlush } from '@/lib/apiStatus';
import { initTheme } from '@pantry-host/shared/theme';
import '../styles/globals.css';

export default function App({ Component, pageProps }: AppProps) {
  useEffect(() => {
    // Normalize scheme-prefixed URL variants (at:, http:, https:) to their
    // scheme-named route so route matching works. Some edges/hosts rewrite
    // "://" to "%3A//" or "%3A%2F%2F"; we handle all three shapes.
    {
      const p = window.location.pathname;
      const rewritten = p
        .replace(/^\/at%3A\/\/?/i, '/at/')
        .replace(/^\/at:\/\//, '/at/')
        .replace(/^\/https%3A(?:%2F%2F|\/\/?)/i, '/https/')
        .replace(/^\/https:\/\//i, '/https/')
        .replace(/^\/http%3A(?:%2F%2F|\/\/?)/i, '/http/')
        .replace(/^\/http:\/\//i, '/http/');
      if (rewritten !== p) {
        window.history.replaceState({}, '', rewritten + window.location.search + window.location.hash);
      }
    }

    if ('serviceWorker' in navigator) {
      const buildHash = document.querySelector<HTMLMetaElement>('meta[name="build-hash"]')?.content || 'dev';
      // `updateViaCache: 'none'` bypasses the browser HTTP cache when
      // checking for SW updates — so a newly-deployed sw.js is always
      // fetched fresh rather than served from the HTTP cache. Without
      // this, Rex's unset Cache-Control lets browsers heuristically
      // cache /sw.js for hours, preventing the SW from noticing that
      // the build hash changed on the server.
      navigator.serviceWorker
        .register(`/sw.js?v=${buildHash}`, { updateViaCache: 'none' })
        .catch(console.error);

      // When a new SW activates after a deploy, it posts a 'SW_UPDATED'
      // message. Reload so the page picks up the new HTML + JS bundles.
      // On homescreen PWAs there's no reload button, so this is the only
      // way to escape stale assets without the user force-quitting the app.
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SW_UPDATED') {
          window.location.reload();
        }
      });
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

      // Scroll behavior: respect prefers-reduced-motion (always instant).
      // Otherwise smooth-scroll the first 3 times to teach the user that
      // the main nav lives at the top of the page, not offscreen. After
      // 3 smooth scrolls, switch to instant permanently.
      const SCROLL_KEY = 'pantry-host:smooth-scroll-count';
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      let behavior: ScrollBehavior = 'instant';
      if (!prefersReduced) {
        const count = parseInt(localStorage.getItem(SCROLL_KEY) ?? '0', 10);
        if (count < 3) {
          behavior = 'smooth';
          localStorage.setItem(SCROLL_KEY, String(count + 1));
        }
      }

      const scrollTo = (el: Element) => el.scrollIntoView({ behavior });
      const el = document.getElementById(id);
      if (el) {
        scrollTo(el);
      } else {
        // Element may not exist yet (data still loading). Retry briefly.
        const t = setTimeout(() => {
          const target = document.getElementById(id);
          if (target) scrollTo(target);
        }, 300);
        return () => clearTimeout(t);
      }
    }
  }, []);

  return (
    <KitchenProvider>
      {/* Branding fallback for og:image. Pages with a photo (recipe / menu
          detail) emit their own <meta key="og:image" …/> and override this via
          next/head's key-based dedup, so the output is always exactly one
          og:image — either the page-specific photo or the PWA icon. */}
      <Head>
        <meta key="og:image" property="og:image" content="https://pantryhost.app/icon-512.png" />
      </Head>
      <Nav />
      <OfflineBanner />
      <Component {...pageProps} />
      <Footer />
    </KitchenProvider>
  );
}
