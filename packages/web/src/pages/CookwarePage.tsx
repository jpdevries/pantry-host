import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PencilSimple, Trash } from '@phosphor-icons/react';
import { gql } from '@/lib/gql';

interface CookwareItem {
  id: string;
  name: string;
  brand: string | null;
  tags: string[];
  notes: string | null;
}

const QUERY = `{ cookware { id name brand tags notes } }`;
const ADD_MUTATION = `mutation($name: String!, $brand: String, $tags: [String!], $notes: String) { addCookware(name: $name, brand: $brand, tags: $tags, notes: $notes) { id } }`;
const UPDATE_MUTATION = `mutation($id: String!, $name: String, $brand: String, $tags: [String!], $notes: String) { updateCookware(id: $id, name: $name, brand: $brand, tags: $tags, notes: $notes) { id } }`;
const DELETE_MUTATION = `mutation($id: String!) { deleteCookware(id: $id) }`;

export default function CookwarePage() {
  const [items, setItems] = useState<CookwareItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function load() {
    const { cookware } = await gql<{ cookware: CookwareItem[] }>(QUERY);
    setItems(cookware);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    await gql(DELETE_MUTATION, { id });
    setDeleteConfirm(null);
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Cookware</h1>
        <button
          type="button"
          onClick={() => { setShowForm(!showForm); setEditingId(null); }}
          className="btn-primary"
        >
          {showForm ? 'Cancel' : '+ Add Cookware'}
        </button>
      </div>

      {showForm && (
        <div className="mb-8 p-5 rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)]">
          <h2 className="text-lg font-bold mb-4">Add Cookware</h2>
          <CookwareForm
            onSave={() => { setShowForm(false); load(); }}
            onCancel={() => setShowForm(false)}
          />
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />
          ))}
        </div>
      ) : items.length === 0 && !showForm ? (
        <div className="text-center py-20 text-[var(--color-text-secondary)]">
          <p className="text-lg mb-2">No cookware registered yet.</p>
          <p className="text-sm">Adding your equipment helps with recipe organization.</p>
        </div>
      ) : (
        <ul className="divide-y divide-[var(--color-border-card)]">
          {items.map((item) => (
            <li key={item.id}>
              {editingId === item.id ? (
                <div className="py-4">
                  <CookwareForm
                    cookware={item}
                    onSave={() => { setEditingId(null); load(); }}
                    onCancel={() => setEditingId(null)}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="flex items-center gap-3 py-4">
                  <div className="flex-1 min-w-0">
                    <Link to={`/cookware/${item.id}#stage`} className="font-semibold text-sm hover:underline">
                      {item.name}
                    </Link>
                    {item.brand && (
                      <span className="ml-2 text-xs text-[var(--color-text-secondary)]">{item.brand}</span>
                    )}
                    {item.tags.length > 0 && (
                      <span className="ml-2">
                        {item.tags.map((t) => (
                          <span key={t} className="tag mr-1">{t}</span>
                        ))}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" onClick={() => setEditingId(item.id)} aria-label="Edit" aria-describedby={`cw-${item.id}`} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-2">
                      <PencilSimple size={16} aria-hidden />
                    </button>
                    {deleteConfirm === item.id ? (
                      <div className="flex gap-1 items-center">
                        <span className="text-xs text-[var(--color-text-secondary)] mr-1">Delete?</span>
                        <button type="button" autoFocus onClick={() => handleDelete(item.id)} aria-label="Confirm delete" aria-describedby={`cw-${item.id}`} className="btn-danger text-xs px-2 py-1">Yes</button>
                        <button type="button" onClick={() => setDeleteConfirm(null)} aria-label="Cancel delete" aria-describedby={`cw-${item.id}`} className="btn-secondary text-xs px-2 py-1">No</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => setDeleteConfirm(item.id)} aria-label="Delete" aria-describedby={`cw-${item.id}`} className="text-[var(--color-text-secondary)] hover:text-red-500 p-2">
                        <Trash size={16} aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface FormProps {
  cookware?: CookwareItem;
  onSave: () => void;
  onCancel?: () => void;
  autoFocus?: boolean;
}

function CookwareForm({ cookware, onSave, onCancel, autoFocus }: FormProps) {
  const editing = Boolean(cookware);
  const [name, setName] = useState(cookware?.name ?? '');
  const [brand, setBrand] = useState(cookware?.brand ?? '');
  const [tagInput, setTagInput] = useState(cookware?.tags?.join(', ') ?? '');
  const [notes, setNotes] = useState(cookware?.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
    const mutation = editing && cookware ? UPDATE_MUTATION : ADD_MUTATION;
    const variables = editing && cookware
      ? { id: cookware.id, name: name.trim(), brand: brand || null, tags, notes: notes || null }
      : { name: name.trim(), brand: brand || null, tags, notes: notes || null };
    try {
      await gql(mutation, variables);
    } catch (err) {
      console.error(err);
    }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cw-name" className="field-label">
          Name <span className="text-red-500">*</span>
        </label>
        <input
          id="cw-name"
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Instant Pot"
          className="field-input w-full"
          autoFocus={autoFocus}
        />
      </div>
      <div>
        <label htmlFor="cw-brand" className="field-label">Brand</label>
        <input
          id="cw-brand"
          type="text"
          value={brand}
          onChange={(e) => setBrand(e.target.value)}
          placeholder="e.g. Instant Pot Co."
          className="field-input w-full"
        />
      </div>
      <div>
        <label htmlFor="cw-tags" className="field-label">
          Tags <span className="font-normal text-[var(--color-text-secondary)]">(comma-separated)</span>
        </label>
        <input
          id="cw-tags"
          type="text"
          value={tagInput}
          onChange={(e) => setTagInput(e.target.value)}
          placeholder="e.g. pressure-cooker, slow-cooker"
          className="field-input w-full"
        />
      </div>
      <div>
        <label htmlFor="cw-notes" className="field-label">
          Notes <span className="font-normal text-[var(--color-text-secondary)]">(usage guide, composting rules, etc.)</span>
        </label>
        <textarea
          id="cw-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="e.g. Accepts fruit scraps, veggie scraps, eggshells. Does NOT accept meat, dairy, or oils."
          rows={3}
          className="field-input w-full"
        />
      </div>
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="btn-primary disabled:opacity-50"
        >
          {saving ? 'Saving\u2026' : editing ? 'Save Changes' : 'Add Cookware'}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="btn-secondary">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
