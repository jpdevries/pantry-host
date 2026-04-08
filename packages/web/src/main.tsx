import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTheme } from '@pantry-host/shared/theme';
import { initDB } from '@/lib/db';
import App from './App';
import './globals.css';

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
