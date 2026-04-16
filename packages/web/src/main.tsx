import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTheme } from '@pantry-host/shared/theme';
import { initDB } from '@/lib/db';
import App from './App';
import './globals.css';

// Normalize all "at:" URL variants to /at/ before React Router parses.
// Users (or shared links) may arrive via:
//   /at://did:plc:.../...        (literal :// in path)
//   /at://did%3Aplc%3A.../...    (percent-encoded DID)
//   /at%3A/did%3Aplc%3A.../...   (Cloudflare 307-rewrites /at:// to /at%3A/)
//   /at%3A//did%3Aplc%3A.../...  (variant of the same)
// All route to the same /at/{did}/{collection}/{rkey} handler.
if (typeof window !== 'undefined') {
  const p = window.location.pathname;
  const rewritten = p
    .replace(/^\/at%3A\/\/?/i, '/at/')
    .replace(/^\/at:\/\//, '/at/');
  if (rewritten !== p) {
    window.history.replaceState({}, '', rewritten + window.location.search + window.location.hash);
  }
}

// Initialize theme immediately
initTheme();

// Start PGlite initialization early (non-blocking)
initDB();

// Request persistent storage
if (navigator.storage?.persist) {
  navigator.storage.persist();
}

// Register the service worker so the shell + assets are available offline
// and cross-origin caches (e.g. pantry-host-cooklang-v1) are active. Only
// register in prod builds — the Vite dev server serves source modules that
// should not be cached.
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js')
      .catch((err) => console.warn('[SW] registration failed:', err));
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
