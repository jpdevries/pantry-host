import { useState, useCallback, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import BarcodeScanner, { type ScannedProduct } from './BarcodeScanner';
import { gql } from '@/lib/gql';
import { UNIT_GROUPS, CATEGORIES } from '@pantry-host/shared/constants';

/** localStorage key that mirrors STORE_BARCODE_META. Shared SettingsPage
 *  kebab-cases schema keys (see SettingsPage.tsx::storageKeyFor). */
const STORE_META_KEY = 'store-barcode-meta';

interface BatchItem extends ScannedProduct {
  key: string;
  quantity: number;
  unit: string;
  itemSize?: number;
  itemSizeUnit?: string;
  alwaysOnHand: boolean;
  tags: string[];
}

interface Props {
  open: boolean;
  onComplete: () => void;
  onCancel: () => void;
}

type Phase = 'scanning' | 'review';

const ADD_INGREDIENTS = `
  mutation AddIngredients($inputs: [IngredientInput!]!) {
    addIngredients(inputs: $inputs) { id name }
  }
`;

export default function BatchScanSession({ open, onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [toasts, setToasts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  // Mirror of the STORE_BARCODE_META setting. Local state for reactivity;
  // writes go straight to localStorage so Settings page stays in sync.
  const [storeMetaEnabled, setStoreMetaEnabled] = useState<boolean>(
    () => typeof window !== 'undefined' && localStorage.getItem(STORE_META_KEY) === 'true',
  );
  // Listen for external changes (Settings page save fires a synthetic storage event).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORE_META_KEY) setStoreMetaEnabled(e.newValue === 'true');
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  const toggleStoreMeta = (next: boolean) => {
    setStoreMetaEnabled(next);
    if (typeof window === 'undefined') return;
    if (next) localStorage.setItem(STORE_META_KEY, 'true');
    else localStorage.removeItem(STORE_META_KEY);
    try {
      window.dispatchEvent(new StorageEvent('storage', {
        key: STORE_META_KEY,
        newValue: next ? 'true' : null,
        storageArea: localStorage,
      }));
    } catch {
      /* older webviews */
    }
  };

  const addToast = (msg: string) => {
    setToasts((prev) => [...prev.slice(-4), msg]);
    setTimeout(() => setToasts((prev) => prev.slice(1)), 3000);
  };

  const handleScan = useCallback((product: ScannedProduct) => {
    setItems((prev) => {
      if (prev.some((i) => i.barcode === product.barcode)) {
        addToast(`Already scanned: ${product.name}`);
        return prev;
      }
      addToast(`Added: ${product.name}`);
      return [
        ...prev,
        {
          ...product,
          key: product.barcode,
          quantity: product.quantity ?? 1,
          unit: product.unit ?? 'whole',
          alwaysOnHand: false,
          tags: [],
        },
      ];
    });
  }, []);

  function updateItem(key: string, patch: Partial<BatchItem>) {
    setItems((prev) => prev.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((i) => i.key !== key));
  }

  async function saveAll() {
    setSaving(true);
    try {
      await gql(ADD_INGREDIENTS, {
        inputs: items.map((i) => ({
          name: i.name,
          category: i.category ?? null,
          quantity: i.alwaysOnHand ? null : i.quantity,
          unit: i.alwaysOnHand ? null : i.unit,
          itemSize: i.alwaysOnHand ? null : (i.itemSize ?? null),
          itemSizeUnit: i.alwaysOnHand ? null : (i.itemSizeUnit ?? null),
          alwaysOnHand: i.alwaysOnHand,
          tags: i.tags,
          // Only persist barcode + metadata when the user opts in.
          barcode: storeMetaEnabled ? (i.barcode ?? null) : null,
          productMeta: storeMetaEnabled && i.meta ? JSON.stringify(i.meta) : null,
        })),
      });
    } catch (err) {
      console.error('Failed to save scanned items:', err);
    }
    onComplete();
  }

  return (
    <Dialog.Root open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-[var(--color-bg-body)] z-50" />
        <Dialog.Content
          className="fixed inset-0 z-50 flex flex-col bg-[var(--color-bg-body)] text-[var(--color-text-primary)]"
          aria-describedby={undefined}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border-card)] shrink-0 gap-3">
            <Dialog.Title className="font-bold text-lg">
              {phase === 'scanning' ? 'Scan Groceries' : `Review (${items.length})`}
            </Dialog.Title>
            <label className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] cursor-pointer select-none ml-auto" title="When on, each scanned item's barcode + an allowlisted subset of Open Food Facts data is saved. Power-user feature for MCP agents and nutrition tooling.">
              <input
                type="checkbox"
                checked={storeMetaEnabled}
                onChange={(e) => toggleStoreMeta(e.target.checked)}
                className="accent-[var(--color-accent)]"
              />
              <span>Save barcode data</span>
            </label>
            <Dialog.Close
              aria-label="Cancel batch scan"
              className="text-[var(--color-text-secondary)] hover:underline p-2"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </Dialog.Close>
          </div>

          {phase === 'scanning' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="shrink-0 max-h-[40vh]">
                <BarcodeScanner onScan={handleScan} onError={(msg) => addToast(msg)} />
              </div>

              {/* Toast notifications */}
              <div aria-live="polite" aria-atomic="false" className="shrink-0 px-4 pt-2 space-y-1 min-h-[2.5rem]">
                {toasts.map((msg, i) => (
                  <p key={i} className="text-sm text-[var(--color-accent)] font-medium">{msg}</p>
                ))}
              </div>

              {/* Scanned list preview */}
              <div className="flex-1 overflow-y-auto px-4 py-2">
                {items.length === 0 ? (
                  <p className="text-[var(--color-text-secondary)] text-sm mt-2">Scanned items will appear here…</p>
                ) : (
                  <ul className="space-y-1">
                    {items.map((item) => (
                      <li key={item.key} className="text-[var(--color-text-secondary)] text-sm flex items-center gap-2">
                        <span className="text-[var(--color-accent)]" aria-hidden="true">✓</span>
                        {item.name}
                        {item.brand && <span className="text-[var(--color-text-secondary)]">({item.brand})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* Actions */}
              <div className="shrink-0 flex gap-3 p-4 border-t border-[var(--color-border-card)]">
                <button
                  type="button"
                  onClick={onCancel}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => setPhase('review')}
                  disabled={items.length === 0}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Review {items.length > 0 ? `(${items.length})` : ''}
                </button>
              </div>
            </div>
          )}

          {phase === 'review' && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className="flex-1 overflow-y-auto">
                <ul className="divide-y divide-[var(--color-border-card)]">
                  {items.map((item) => (
                    <li key={item.key} className="px-4 py-4">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <p className="font-semibold">{item.name}</p>
                          {item.brand && <p className="text-xs text-[var(--color-text-secondary)]">{item.brand}</p>}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.key)}
                          aria-label={`Remove ${item.name}`}
                          className="text-[var(--color-text-secondary)] hover:text-red-400 p-1 shrink-0"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <fieldset>
                          <legend className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Quantity &amp; Unit</legend>
                          {item.alwaysOnHand ? (
                            <p className="text-xs text-[var(--color-accent)] mt-1">Always on hand</p>
                          ) : (
                            <div className="flex gap-1">
                              <input
                                type="number"
                                min="0"
                                step="any"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.key, { quantity: parseFloat(e.target.value) || 0 })}
                                aria-label={`Quantity for ${item.name}`}
                                className="field-input w-20"
                              />
                              <select
                                value={item.unit}
                                onChange={(e) => updateItem(item.key, { unit: e.target.value })}
                                aria-label={`Unit for ${item.name}`}
                                className="field-select flex-1"
                              >
                                {UNIT_GROUPS.map((g) => (
                                  <optgroup key={g.label} label={g.label}>
                                    {g.units.map((u) => <option key={u} value={u}>{u}</option>)}
                                  </optgroup>
                                ))}
                                <optgroup label="Other">
                                  <option value="whole">whole</option>
                                </optgroup>
                              </select>
                            </div>
                          )}
                        </fieldset>

                        <div>
                          <label htmlFor={`cat-${item.key}`} className="block text-xs font-medium mb-1 text-[var(--color-text-secondary)]">Category</label>
                          <select
                            id={`cat-${item.key}`}
                            value={item.category ?? ''}
                            onChange={(e) => updateItem(item.key, { category: e.target.value })}
                            className="field-select w-full"
                          >
                            <option value="">— select —</option>
                            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                          </select>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 mt-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={item.alwaysOnHand}
                          onChange={(e) => updateItem(item.key, { alwaysOnHand: e.target.checked })}
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-[var(--color-text-secondary)]">Always on hand</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="shrink-0 flex gap-3 p-4 border-t border-[var(--color-border-card)]">
                <button
                  type="button"
                  onClick={() => setPhase('scanning')}
                  className="btn-secondary flex-1"
                >
                  ← Scan More
                </button>
                <button
                  type="button"
                  onClick={saveAll}
                  disabled={saving || items.length === 0}
                  aria-busy={saving}
                  className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {saving ? 'Saving\u2026' : `Save All (${items.length})`}
                </button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
