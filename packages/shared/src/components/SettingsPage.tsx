/**
 * Shared Settings page rendered by both packages (app + web).
 *
 * The caller provides a SettingsAdapter which knows how to load/save
 * values against its own backing store. The component takes care of
 * schema rendering, dirty state, save, loading/error states, secret
 * show/hide, and the "locked / not available" empty state.
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { Info, Eye, EyeSlash, MapPin, SpinnerGap } from '@phosphor-icons/react';
import {
  SETTINGS_SCHEMA,
  type SettingKey,
  type SettingDef,
  type SettingGroup,
} from '../settings-schema';
import { usePreferBrowserChrome } from './prefer-browser-chrome';

/**
 * Collapse a flat schema list into render segments. Consecutive entries
 * that share the same `group.id` merge into one segment, which the
 * render loop wraps in a <fieldset><legend>. Ungrouped entries become
 * one segment each (effectively passthrough). Order is preserved.
 */
interface SchemaSegment {
  group: SettingGroup | null;
  defs: SettingDef[];
}
function bucketByGroup(defs: SettingDef[]): SchemaSegment[] {
  const out: SchemaSegment[] = [];
  for (const def of defs) {
    const last = out[out.length - 1];
    if (def.group && last && last.group && last.group.id === def.group.id) {
      last.defs.push(def);
    } else if (def.group) {
      out.push({ group: def.group, defs: [def] });
    } else {
      out.push({ group: null, defs: [def] });
    }
  }
  return out;
}

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
  /** When set, the form submits as a native POST to this URL instead of
   *  calling adapter.save(). The page does a full navigation + redirect. */
  formAction?: string;
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
        // For booleans, honor explicit `defaultValue`; fall back to 'true'
        // only when defaultValue isn't set (legacy behavior).
        const booleanDefault = def.defaultValue ?? 'true';
        next[def.key] = {
          value: raw ?? (def.kind === 'boolean' ? booleanDefault : ''),
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

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }
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
        <form
          onSubmit={adapter.formAction ? undefined : handleSubmit}
          action={adapter.formAction}
          method={adapter.formAction ? 'POST' : undefined}
          className="space-y-8"
        >
          {bucketByGroup(schemaForPackage).map((segment, i) => {
            const children = segment.defs.map((def) => (
              <SettingField
                key={def.key}
                def={def}
                field={fields[def.key]}
                revealed={revealed.has(def.key)}
                canReveal={!!adapter.reveal && def.kind === 'secret'}
                nativeForm={!!adapter.formAction}
                onChange={(v) => setField(def.key, v)}
                onReveal={() => handleReveal(def.key)}
                onHide={() => handleHide(def.key)}
              >
                {def.key === 'HARVEST_LOCATIONS' && (
                  <NearbyMarkets
                    value={fields[def.key]?.value ?? ''}
                    onChange={(v) => setField(def.key, v)}
                  />
                )}
              </SettingField>
            ));
            if (!segment.group) {
              return <div key={`g-${i}`} className="space-y-8">{children}</div>;
            }
            return (
              <fieldset
                key={`g-${i}-${segment.group.id}`}
                className="card p-5 space-y-5 border border-[var(--color-border-card)]"
              >
                <legend className="px-2 text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)]">
                  {segment.group.legend}
                </legend>
                {children}
              </fieldset>
            );
          })}

          {error && <p role="alert" className="text-sm text-red-400">{error}</p>}

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

const NEARBY_API = 'https://feed.pantryhost.app/api/nearby';

interface NearbyMarket {
  name: string;
  slug: string;
  type: string;
}

function NearbyMarkets({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [markets, setMarkets] = useState<NearbyMarket[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const statusRef = useRef<HTMLParagraphElement>(null);

  const currentTags = value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);

  function toggleTag(slug: string) {
    if (currentTags.includes(slug)) {
      onChange(currentTags.filter((t) => t !== slug).join(', '));
    } else {
      onChange([...currentTags, slug].join(', '));
    }
  }

  function handleCheck(checked: boolean) {
    setEnabled(checked);
    if (!checked) {
      setMarkets([]);
      setStatus(null);
      return;
    }

    if (!navigator.geolocation) {
      setStatus('Geolocation is not supported by your browser.');
      return;
    }

    setLoading(true);
    setStatus('Locating\u2026');

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const res = await fetch(
            `${NEARBY_API}?lat=${pos.coords.latitude}&lng=${pos.coords.longitude}`
          );
          if (!res.ok) throw new Error(`API returned ${res.status}`);
          const data = (await res.json()) as NearbyMarket[];
          setMarkets(data);
          setStatus(data.length > 0 ? `Found ${data.length} market${data.length !== 1 ? 's' : ''} nearby.` : 'No markets found nearby.');
        } catch {
          setStatus('Failed to fetch nearby markets.');
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        setLoading(false);
        if (err.code === err.PERMISSION_DENIED) {
          setStatus('Location access denied.');
          setEnabled(false);
        } else {
          setStatus('Unable to determine your location.');
        }
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }

  // Determine which tags match current input text (for round-trip highlighting)
  const inputLower = value.toLowerCase();

  return (
    <div className="mt-4">
      <label className="flex items-center gap-2 cursor-pointer text-sm">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(e) => handleCheck(e.target.checked)}
          className="w-4 h-4 accent-[var(--color-accent)]"
        />
        <MapPin size={14} weight="light" aria-hidden />
        Suggest nearby markets based on my location
      </label>

      <div aria-live="polite" aria-atomic="true">
        {status && (
          <p ref={statusRef} className="text-xs text-[var(--color-text-secondary)] mt-2">
            {loading && <SpinnerGap size={12} className="inline animate-spin mr-1" aria-hidden />}
            {status}
          </p>
        )}
      </div>

      {markets.length > 0 && (
        <div role="group" aria-label="Nearby markets" className="flex flex-wrap gap-2 mt-3">
          {markets.map((m) => {
            const active = currentTags.includes(m.slug);
            const partialMatch = !active && m.slug.includes(inputLower.split(',').pop()?.trim() || '\x00');
            return (
              <button
                key={m.slug}
                type="button"
                role="switch"
                aria-checked={active}
                data-match={partialMatch || undefined}
                onClick={() => toggleTag(m.slug)}
                className="text-xs px-3 py-1.5 rounded-full border-2 transition-colors cursor-pointer"
              >
                {m.slug}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function SettingField({
  def,
  field,
  revealed,
  canReveal,
  nativeForm,
  onChange,
  onReveal,
  onHide,
  children,
}: {
  def: SettingDef;
  field: FieldState | undefined;
  revealed: boolean;
  canReveal: boolean;
  /** True when the form uses native POST (no JS save). */
  nativeForm: boolean;
  onChange: (value: string) => void;
  onReveal: () => void;
  onHide: () => void;
  children?: React.ReactNode;
}) {
  const id = `setting-${def.key}`;
  const descId = `${id}-desc`;

  if (def.kind === 'boolean') {
    return (
      <BooleanField
        def={def}
        field={field}
        id={id}
        descId={descId}
        onChange={onChange}
      />
    );
  }

  // (Boolean fields handled above via <BooleanField>; non-boolean fields below.)
  return (
    <div className="card p-5">
      <label htmlFor={id} className="block text-sm font-semibold mb-1">
        {def.label}
      </label>
      <p id={descId} className="text-xs text-[var(--color-text-secondary)] mb-3 legible pretty">
        {def.description}
      </p>
      <div className="relative">
        {/* For native form POST: masked, unedited secrets send a sentinel
            so the server knows to skip them. The visible input loses its
            name to avoid double-submission. */}
        {nativeForm && def.kind === 'secret' && field?.masked && !field.dirty && (
          <input type="hidden" name={def.key} value="__UNCHANGED__" />
        )}
        <input
          id={id}
          name={(nativeForm && def.kind === 'secret' && field?.masked && !field.dirty)
            ? undefined : def.key}
          type={def.kind === 'secret' && !revealed ? 'password' : 'text'}
          value={field?.value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          placeholder={def.placeholder}
          pattern={def.pattern}
          title={def.patternTitle}
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
      {children}
    </div>
  );
}

/**
 * Boolean checkbox field. Special-cases PREFER_BROWSER_CHROME so the
 * displayed checked-state reflects the EFFECTIVE preference (which may
 * include the touch-first auto-flip), not just the raw stored value.
 * Toggling stores 'true' / 'false' explicitly; an explicit 'false' on a
 * touch device overrides the auto-flip.
 */
function BooleanField({
  def,
  field,
  id,
  descId,
  onChange,
}: {
  def: SettingDef;
  field: FieldState | undefined;
  id: string;
  descId: string;
  onChange: (value: string) => void;
}) {
  const effectivePref = usePreferBrowserChrome();
  const stored = field?.value;
  const checked =
    def.key === 'PREFER_BROWSER_CHROME'
      ? effectivePref
      : (stored ?? def.defaultValue ?? 'true') !== 'false';
  return (
    <div className="card p-5">
      <label htmlFor={id} className="flex items-start gap-3 cursor-pointer">
        <input
          id={id}
          name={def.key}
          type="checkbox"
          checked={checked}
          value="true"
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
