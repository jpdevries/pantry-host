/**
 * Shared Settings page rendered by both packages (app + web).
 *
 * The caller provides a SettingsAdapter which knows how to load/save
 * values against its own backing store. The component takes care of
 * schema rendering, dirty state, save, loading/error states, secret
 * show/hide, and the "locked / not available" empty state.
 */
import { useState, useEffect, useCallback } from 'react';
import { Info, Eye, EyeSlash } from '@phosphor-icons/react';
import {
  SETTINGS_SCHEMA,
  type SettingKey,
  type SettingDef,
} from '../settings-schema';

export interface SettingsAdapter {
  /** Load current values for all keys in the schema applicable to this package. */
  load(): Promise<{
    values: Record<string, string | null>;
    /** Masked secrets will be present in `values`; this set tells the form which
     *  fields are currently showing a masked placeholder rather than real data. */
    maskedKeys?: Set<string>;
  }>;
  /** Reveal a single secret value on explicit user request. */
  reveal?(key: SettingKey): Promise<string | null>;
  /** Persist the given value map. Keys missing/null are deleted. */
  save(changes: Record<string, string | null>): Promise<Record<string, string | null>>;
  /** Which package are we running in — filters schema entries. */
  pkg: 'app' | 'web';
  /** "This machine", "This browser" — rendered in the header. */
  scopeLabel: string;
  /** Optional notice shown after save (e.g. "restart server to apply"). */
  postSaveNotice?: string;
  /** True to render the "not available to guests" view instead of the form. */
  locked?: boolean;
  lockedMessage?: string;
}

type FieldState = {
  /** Current form value (what the input shows). */
  value: string;
  /** True if this is a secret and the displayed value is masked. */
  masked: boolean;
  /** True if the user has modified this field since load. */
  dirty: boolean;
};

export default function SettingsPage({ adapter }: { adapter: SettingsAdapter }) {
  const schemaForPackage = SETTINGS_SCHEMA.filter((s) => s.packages.includes(adapter.pkg));

  const [fields, setFields] = useState<Record<string, FieldState>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    try {
      const { values, maskedKeys } = await adapter.load();
      const next: Record<string, FieldState> = {};
      for (const def of schemaForPackage) {
        const raw = values[def.key];
        next[def.key] = {
          value: raw ?? (def.kind === 'boolean' ? 'true' : ''),
          masked: def.kind === 'secret' && !!maskedKeys?.has(def.key) && !!raw,
          dirty: false,
        };
      }
      setFields(next);
      setLoaded(true);
    } catch (err) {
      setError(`Couldn't load settings: ${(err as Error).message}`);
      setLoaded(true);
    }
  }, [adapter, schemaForPackage]);

  useEffect(() => {
    refresh();
    // adapter should be stable-ish, we intentionally exclude to avoid loops
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setField(key: SettingKey, value: string) {
    setFields((prev) => ({
      ...prev,
      [key]: { value, masked: false, dirty: true },
    }));
    setFlash(null);
  }

  async function handleReveal(key: SettingKey) {
    if (!adapter.reveal) return;
    try {
      const v = await adapter.reveal(key);
      setFields((prev) => ({
        ...prev,
        [key]: { value: v ?? '', masked: false, dirty: false },
      }));
      setRevealed((prev) => new Set(prev).add(key));
    } catch (err) {
      setError(`Couldn't reveal secret: ${(err as Error).message}`);
    }
  }

  function handleHide(key: SettingKey) {
    setRevealed((prev) => {
      const next = new Set(prev);
      next.delete(key);
      return next;
    });
    // Re-load from adapter to get the masked form back.
    refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setFlash(null);
    try {
      const changes: Record<string, string | null> = {};
      for (const def of schemaForPackage) {
        const f = fields[def.key];
        if (!f || !f.dirty) continue;
        // Empty secret field = delete the key.
        if (def.kind === 'secret' && f.value.trim() === '') {
          changes[def.key] = null;
        } else {
          changes[def.key] = f.value;
        }
      }
      if (Object.keys(changes).length === 0) {
        setFlash('No changes to save.');
        setSaving(false);
        return;
      }
      await adapter.save(changes);
      setFlash('Saved.');
      // Reload from the source of truth so masked state is correct.
      await refresh();
    } catch (err) {
      setError(`Save failed: ${(err as Error).message}`);
    } finally {
      setSaving(false);
    }
  }

  if (adapter.locked) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold mb-4">Settings</h1>
        <div className="card p-6 flex items-start gap-3">
          <Info size={20} className="shrink-0 mt-0.5" aria-hidden />
          <p className="text-sm text-[var(--color-text-secondary)] legible pretty">
            {adapter.lockedMessage ??
              'Settings are only available to the machine owner. Ask the person who set up Pantry Host to configure them.'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold mb-2">Settings</h1>
      <p className="text-sm text-[var(--color-text-secondary)] mb-8 legible pretty">
        Scope: {adapter.scopeLabel}. Changes persist across sessions.
      </p>

      {!loaded && <p className="text-sm text-[var(--color-text-secondary)]">Loading…</p>}

      {loaded && (
        <form onSubmit={handleSubmit} className="space-y-8">
          {schemaForPackage.map((def) => (
            <SettingField
              key={def.key}
              def={def}
              field={fields[def.key]}
              revealed={revealed.has(def.key)}
              canReveal={!!adapter.reveal && def.kind === 'secret'}
              onChange={(v) => setField(def.key, v)}
              onReveal={() => handleReveal(def.key)}
              onHide={() => handleHide(def.key)}
            />
          ))}

          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
          {flash && <p className="text-sm text-[var(--color-accent)]">{flash}</p>}
          {adapter.postSaveNotice && flash === 'Saved.' && (
            <p className="text-sm text-[var(--color-text-secondary)] legible pretty">
              {adapter.postSaveNotice}
            </p>
          )}

          <div className="flex justify-end">
            <button type="submit" disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function SettingField({
  def,
  field,
  revealed,
  canReveal,
  onChange,
  onReveal,
  onHide,
}: {
  def: SettingDef;
  field: FieldState | undefined;
  revealed: boolean;
  canReveal: boolean;
  onChange: (value: string) => void;
  onReveal: () => void;
  onHide: () => void;
}) {
  const id = `setting-${def.key}`;
  const descId = `${id}-desc`;

  if (def.kind === 'boolean') {
    const checked = field?.value !== 'false';
    return (
      <div className="card p-5">
        <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
          <input
            id={id}
            type="checkbox"
            checked={checked}
            onChange={(e) => onChange(e.target.checked ? 'true' : 'false')}
            className="mt-1 w-4 h-4 shrink-0 accent-accent"
            aria-describedby={descId}
          />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">{def.label}</p>
            <p id={descId} className="text-xs text-[var(--color-text-secondary)] mt-1 legible pretty">
              {def.description}
            </p>
          </div>
        </label>
      </div>
    );
  }

  return (
    <div className="card p-5">
      <label htmlFor={id} className="block text-sm font-semibold mb-1">
        {def.label}
      </label>
      <p id={descId} className="text-xs text-[var(--color-text-secondary)] mb-3 legible pretty">
        {def.description}
      </p>
      <div className="relative">
        <input
          id={id}
          type={def.kind === 'secret' && !revealed ? 'password' : 'text'}
          value={field?.value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
          aria-describedby={descId}
          autoComplete="off"
          spellCheck={false}
          className="field-input w-full pr-10"
        />
        {def.kind === 'secret' && canReveal && (
          <button
            type="button"
            onClick={revealed ? onHide : onReveal}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            aria-label={revealed ? 'Hide secret' : 'Show secret'}
          >
            {revealed ? <EyeSlash size={16} /> : <Eye size={16} />}
          </button>
        )}
      </div>
      {field?.masked && !revealed && (
        <p className="text-xs text-[var(--color-text-secondary)] mt-2">
          A value is set. Showing a masked preview — type a new one to replace, leave blank and save to delete.
        </p>
      )}
      {def.externalLinkHref && (
        <p className="mt-2 text-xs">
          <a href={def.externalLinkHref} target="_blank" rel="noopener noreferrer" className="underline text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">
            {def.externalLinkLabel ?? def.externalLinkHref}
          </a>
        </p>
      )}
    </div>
  );
}
