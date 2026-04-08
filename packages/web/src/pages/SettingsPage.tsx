/**
 * Browser-native Settings page backed by localStorage.
 *
 * Every setting in the shared schema that applies to package 'web' is
 * read from / written to a kebab-cased localStorage key:
 *   RECIPE_API_KEY    → localStorage['recipe-api-key']
 *   SHOW_COCKTAILDB   → localStorage['show-cocktaildb']
 *
 * No owner gate, no secret masking — the data lives in the user's own
 * browser. Changes are instant (localStorage writes don't need a
 * restart), but we still dispatch a synthetic `storage` event so other
 * tabs of the same origin can react when we wire listeners in the
 * future.
 */
import { useMemo } from 'react';
import SharedSettingsPage, { type SettingsAdapter } from '@pantry-host/shared/components/SettingsPage';
import { SETTINGS_SCHEMA, type SettingKey } from '@pantry-host/shared/settings-schema';

function storageKeyFor(key: SettingKey): string {
  return key.toLowerCase().replace(/_/g, '-');
}

function useWebAdapter(): SettingsAdapter {
  return useMemo<SettingsAdapter>(
    () => ({
      pkg: 'web',
      scopeLabel: 'This browser (localStorage)',
      async load() {
        const values: Record<string, string | null> = {};
        for (const def of SETTINGS_SCHEMA) {
          if (!def.packages.includes('web')) continue;
          const ls = storageKeyFor(def.key as SettingKey);
          values[def.key] = typeof window !== 'undefined' ? localStorage.getItem(ls) : null;
        }
        // We deliberately don't mask secrets on web — it's the user's own
        // browser; they can inspect localStorage directly. Showing the real
        // value is consistent with that reality.
        return { values };
      },
      async save(changes) {
        if (typeof window === 'undefined') return {};
        for (const [key, value] of Object.entries(changes)) {
          const ls = storageKeyFor(key as SettingKey);
          if (value === null || value === '') {
            localStorage.removeItem(ls);
          } else {
            localStorage.setItem(ls, value);
          }
          // Fire a synthetic storage event so any listeners in-page (not
          // other tabs — the native event only fires cross-tab) can react.
          try {
            window.dispatchEvent(
              new StorageEvent('storage', {
                key: ls,
                newValue: value,
                storageArea: localStorage,
              }),
            );
          } catch {
            /* StorageEvent constructor is unavailable in some old webviews */
          }
        }
        return {};
      },
    }),
    [],
  );
}

export default function SettingsPage() {
  const adapter = useWebAdapter();
  return <SharedSettingsPage adapter={adapter} />;
}
