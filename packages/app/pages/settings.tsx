import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import SettingsPage, { type SettingsAdapter } from '@pantry-host/shared/components/SettingsPage';
import type { SettingKey } from '@pantry-host/shared/settings-schema';
import { refreshPixabaySettings } from '@/components/RecipeCard';

/**
 * Self-hosted Settings page. Wraps the shared SettingsPage with an adapter
 * that round-trips through /api/settings-read and /api/settings-write,
 * both of which enforce the owner gate (loopback Host header or HTTPS).
 */
function useAppAdapter(): SettingsAdapter {
  return useMemo<SettingsAdapter>(
    () => ({
      pkg: 'app',
      scopeLabel: 'This machine',
      postSaveNotice:
        "Changes take effect on the next page load — no server restart needed.",
      async load() {
        const res = await fetch('/api/settings-read');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          locked?: boolean;
          values?: Record<string, string | null> | null;
          maskedKeys?: string[];
        };
        if (json.locked || !json.values) {
          // This adapter instance is now "locked" — caller will re-check.
          return { values: {}, maskedKeys: new Set() };
        }
        return {
          values: json.values,
          maskedKeys: new Set(json.maskedKeys ?? []),
        };
      },
      async reveal(key: SettingKey) {
        const res = await fetch(`/api/settings-read?reveal=${encodeURIComponent(key)}`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { value: string | null };
        return json.value ?? null;
      },
      async save(changes) {
        const res = await fetch('/api/settings-write', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ values: changes }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => '');
          throw new Error(body || `HTTP ${res.status}`);
        }
        // Push any Pixabay setting changes to open RecipeCards in this tab.
        if ('PIXABAY_API_KEY' in changes || 'PIXABAY_FALLBACK_ENABLED' in changes) {
          refreshPixabaySettings();
        }
        // Sync harvest locations to localStorage for grocery list page
        if ('HARVEST_LOCATIONS' in changes) {
          const val = changes.HARVEST_LOCATIONS;
          if (val) localStorage.setItem('harvest-locations', val);
          else localStorage.removeItem('harvest-locations');
        }
        return {};
      },
    }),
    [],
  );
}

function LockedAdapter(message: string): SettingsAdapter {
  return {
    pkg: 'app',
    scopeLabel: 'This machine',
    locked: true,
    lockedMessage: message,
    async load() {
      return { values: {} };
    },
    async save() {
      throw new Error('Locked');
    },
  };
}

export default function AppSettingsPage() {
  // The shared component's adapter.load() always runs first; if the
  // server says locked, we swap in a locked adapter so the empty-state
  // view is rendered. Using a small wrapper component so that runs once.
  return (
    <>
      <Head>
        <title>Settings | Pantry Host</title>
        <meta name="description" content="Configure your Pantry Host instance — theme, API keys, and preferences." />
        <meta property="og:title" content="Settings — Pantry Host" />
        <meta property="og:description" content="Configure your Pantry Host instance — theme, API keys, and preferences." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary" />
      </Head>
      <AppSettingsInner />
    </>
  );
}

function AppSettingsInner() {
  const liveAdapter = useAppAdapter();
  const [locked, setLocked] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/settings-read')
      .then((r) => (r.ok ? r.json() : { locked: true }))
      .then((j: { locked?: boolean }) => setLocked(!!j.locked))
      .catch(() => setLocked(true));
  }, []);

  if (locked === null) {
    return <p className="max-w-2xl mx-auto py-12 px-4 text-sm text-[var(--color-text-secondary)]">Loading…</p>;
  }

  if (locked) {
    return (
      <SettingsPage
        adapter={LockedAdapter(
          'Settings are only available to the machine owner (localhost or HTTPS). Ask the person who set up Pantry Host to configure them.',
        )}
      />
    );
  }

  return <SettingsPage adapter={liveAdapter} />;
}
