import { useState, useCallback } from 'react';
import BarcodeScanner, { ScannedProduct } from './BarcodeScanner';
import { gql } from '@/lib/gql';
import { UNIT_GROUPS, CATEGORIES } from '@/lib/constants';

interface BatchItem extends ScannedProduct {
  key: string;
  quantity: number;
  unit: string;
  alwaysOnHand: boolean;
  tags: string[];
}

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

type Phase = 'scanning' | 'review';

const ADD_INGREDIENTS = `
  mutation AddIngredients($inputs: [IngredientInput!]!) {
    addIngredients(inputs: $inputs) { id name }
  }
`;

export default function BatchScanSession({ onComplete, onCancel }: Props) {
  const [phase, setPhase] = useState<Phase>('scanning');
  const [items, setItems] = useState<BatchItem[]>([]);
  const [toasts, setToasts] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addToast = (msg: string) => {
    setToasts((prev) => [...prev.slice(-4), msg]);
    setTimeout(() => setToasts((prev) => prev.slice(1)), 3000);
  };

  const handleScan = useCallback((product: ScannedProduct) => {
    setItems((prev) => {
      // Deduplicate by barcode
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
    setError(null);
    try {
      await gql(ADD_INGREDIENTS, {
        inputs: items.map((i) => ({
          name: i.name,
          category: i.category ?? null,
          quantity: i.alwaysOnHand ? null : i.quantity,
          unit: i.alwaysOnHand ? null : i.unit,
          alwaysOnHand: i.alwaysOnHand,
          tags: i.tags,
        })),
      });
      onComplete();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-zinc-950 flex flex-col" role="dialog" aria-modal="true" aria-label="Batch scan groceries">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
        <h2 className="text-zinc-50 font-bold text-lg">
          {phase === 'scanning' ? 'Scan Groceries' : `Review (${items.length})`}
        </h2>
        <button
          type="button"
          onClick={onCancel}
          aria-label="Cancel batch scan"
          className="text-zinc-400 hover:text-zinc-50 p-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
        </button>
      </div>

      {phase === 'scanning' && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Camera */}
          <div className="shrink-0">
            <BarcodeScanner onScan={handleScan} onError={(msg) => addToast(msg)} />
          </div>

          {/* Toast notifications */}
          <div aria-live="polite" aria-atomic="false" className="shrink-0 px-4 pt-2 space-y-1 min-h-[2.5rem]">
            {toasts.map((msg, i) => (
              <p key={i} className="text-sm text-accent font-medium">{msg}</p>
            ))}
          </div>

          {/* Scanned list preview */}
          <div className="flex-1 overflow-y-auto px-4 py-2">
            {items.length === 0 ? (
              <p className="text-zinc-500 text-sm mt-2">Scanned items will appear here…</p>
            ) : (
              <ul role="list" className="space-y-1">
                {items.map((item) => (
                  <li key={item.key} className="text-zinc-300 text-sm flex items-center gap-2">
                    <span className="text-accent">✓</span>
                    {item.name}
                    {item.brand && <span className="text-zinc-500">({item.brand})</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Actions */}
          <div className="shrink-0 flex gap-3 p-4 border-t border-zinc-800">
            <button
              type="button"
              onClick={onCancel}
              className="btn-secondary flex-1 border-zinc-700 text-zinc-300"
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
            <ul role="list" className="divide-y divide-zinc-800">
              {items.map((item) => (
                <li key={item.key} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <p className="font-semibold text-zinc-50">{item.name}</p>
                      {item.brand && <p className="text-xs text-zinc-400">{item.brand}</p>}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.key)}
                      aria-label={`Remove ${item.name}`}
                      className="text-zinc-500 hover:text-red-400 p-1 shrink-0"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <fieldset>
                      <legend className="field-label">Quantity &amp; Unit</legend>
                      {item.alwaysOnHand ? (
                        <p className="text-xs text-accent mt-1">Always on hand</p>
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
                      <label htmlFor={`cat-${item.key}`} className="field-label">Category</label>
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
                      className="w-4 h-4 accent-accent"
                    />
                    <span className="text-sm text-zinc-300">Always on hand</span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {error && (
            <p role="alert" className="px-4 py-2 text-sm text-red-400">{error}</p>
          )}

          <div className="shrink-0 flex gap-3 p-4 border-t border-zinc-800">
            <button type="button" onClick={() => setPhase('scanning')} className="btn-secondary flex-1 border-zinc-700 text-zinc-300">
              ← Scan More
            </button>
            <button
              type="button"
              onClick={saveAll}
              disabled={saving || items.length === 0}
              aria-busy={saving}
              className="btn-primary flex-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving…' : `Save All (${items.length})`}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
