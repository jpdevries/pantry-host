import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { initTheme } from '@pantry-host/shared/theme';
import { initDB } from '@/lib/db';
import App from './App';
import './globals.css';

// Normalize scheme-prefixed URL variants (at:, http:, https:) to their
// scheme-named route so React Router matches. Users may paste:
//   /at://did:plc:.../...                    → /at/...
//   /at%3A/... or /at%3A//...                → /at/...
//   /https://example.com/recipe              → /https/example.com/recipe
//   /https%3A//... or /https%3A%2F%2F...     → /https/...
//   /http://… and /http%3A/… equivalents    → /http/...
if (typeof window !== 'undefined') {
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

// Initialize theme immediately
initTheme();

// Start SQLite initialization early (non-blocking)
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
