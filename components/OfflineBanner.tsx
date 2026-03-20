import { useState, useEffect } from 'react';
import { queueLength } from '@/lib/offlineQueue';
import { isApiOnline, API_STATUS_EVENT } from '@/lib/apiStatus';

export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  const [queued, setQueued] = useState(0);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Use API reachability, not navigator.onLine — phone has 5G at grocery store
    // but can't reach the Mac Mini at home
    function onApiStatus(e: Event) {
      const online = (e as CustomEvent<{ online: boolean }>).detail.online;
      if (!online) { setOffline(true); setDismissed(false); setQueued(queueLength()); }
      else { setOffline(false); setQueued(0); }
    }

    setOffline(!isApiOnline());

    window.addEventListener(API_STATUS_EVENT, onApiStatus);
    return () => window.removeEventListener(API_STATUS_EVENT, onApiStatus);
  }, []);

  // Update queued count whenever storage changes (mutations added by other components)
  useEffect(() => {
    if (!offline) return;
    function onStorage(e: StorageEvent) {
      if (e.key === 'offlineQueue') setQueued(queueLength());
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [offline]);

  if (!offline || dismissed) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center justify-between gap-3 px-4 py-2 bg-zinc-800 dark:bg-zinc-700 text-white text-sm"
    >
      <span>
        You&apos;re away from your pantry — changes will sync when you reconnect.
        {queued > 0 && <span className="ml-2 opacity-75">({queued} pending)</span>}
      </span>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        aria-label="Dismiss offline banner"
        className="shrink-0 opacity-70 hover:opacity-100 transition-opacity"
      >
        ×
      </button>
    </div>
  );
}
