import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import SettingsPage, { type SettingsAdapter } from '@pantry-host/shared/components/SettingsPage';
import type { SettingKey } from '@pantry-host/shared/settings-schema';
import { isOwnerRequest } from '@pantry-host/shared/owner-request';
import DeviceSettings from '@/components/DeviceSettings';

/** What /api/settings-read answers (minus ?reveal), seeded by the server. */
type SettingsProps =
  | { locked: true; values: null }
  | { locked: false; values: Record<string, string | null>; maskedKeys: string[] };

/**
 * Server-render the settings page so it works without JS (e.g. the Kindle's
 * Silk 80, which can't run the bundles and used to sit on "Loading…").
 *
 * The owner gate only needs the request headers. Values can't be read here:
 * Rex's V8 SSR stubs `fs`, so the overrides file is invisible. Owners' values
 * come from the GraphQL host's /api/settings-read instead (the Rust server
 * implements it natively; loopback, which is what this fetch is, counts as
 * owner there, and we only ask after our own owner check). If that isn't
 * available (e.g. the Node dev GraphQL server), return nothing and the page
 * falls back to its client-side fetch. The Rust SPA shell seeds the same
 * `settings` prop itself (packages/server/src/frontend.rs).
 */
export async function getServerSideProps(ctx: { headers?: Record<string, string> }): Promise<{ props: { settings?: SettingsProps } }> {
  if (!isOwnerRequest(ctx.headers ?? {})) {
    return { props: { settings: { locked: true, values: null } } };
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 3000);
  try {
    const res = await fetch('http://127.0.0.1:4001/api/settings-read', { signal: controller.signal });
    if (res.ok) {
      const json = (await res.json()) as { locked?: boolean; values?: Record<string, string | null> | null; maskedKeys?: string[] };
      if (!json.locked && json.values) {
        return { props: { settings: { locked: false, values: json.values, maskedKeys: json.maskedKeys ?? [] } } };
      }
    }
  } catch {
    /* fall through to the client-side fetch */
  } finally {
    clearTimeout(timer);
  }
  return { props: {} };
}

/**
 * Self-hosted Settings page. Wraps the shared SettingsPage with an adapter
 * that round-trips through /api/settings-read and /api/settings-write,
 * both of which enforce the owner gate (loopback Host header or HTTPS).
 *
 * Save uses a native <form method="POST"> — the browser does a full page
 * navigation, the server writes the overrides file and redirects back to
 * /settings. No AJAX, no JSON, no client-side state refresh.
 */
function useAppAdapter(): SettingsAdapter {
  return useMemo<SettingsAdapter>(
    () => ({
      pkg: 'app',
      scopeLabel: 'This machine',
      postSaveNotice:
        "Changes take effect on the next page load — no server restart needed.",
      formAction: '/api/settings-write',
      async load() {
        const res = await fetch('/api/settings-read');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as {
          locked?: boolean;
          values?: Record<string, string | null> | null;
          maskedKeys?: string[];
        };
        if (json.locked || !json.values) {
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
      async save() {
        // Unused in formAction mode — the browser handles the POST.
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

export default function AppSettingsPage({ settings }: { settings?: SettingsProps }) {
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
      <main id="stage" className="max-sm:min-h-screen">
        <AppSettingsInner initial={settings} />
        <DeviceSettings />
      </main>
    </>
  );
}

function AppSettingsInner({ initial }: { initial?: SettingsProps }) {
  const liveAdapter = useAppAdapter();
  const [locked, setLocked] = useState<boolean | null>(initial ? initial.locked : null);

  useEffect(() => {
    if (initial) return; // the server already decided
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

  return (
    <SettingsPage
      adapter={liveAdapter}
      initial={initial && !initial.locked ? { values: initial.values, maskedKeys: initial.maskedKeys } : undefined}
    />
  );
}
