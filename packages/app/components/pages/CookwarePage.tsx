import Head from 'next/head';
import { useState, useEffect } from 'react';
import { COMMON_COOKWARE } from '@pantry-host/shared/constants';
import { gql } from '@/lib/gql';
import { enqueue } from '@/lib/offlineQueue';
import { PencilSimple, Trash } from '@phosphor-icons/react';
import { isOwner } from '@/lib/isTrustedNetwork';

interface Cookware {
  id: string;
  name: string;
  brand: string | null;
  tags: string[];
  notes: string | null;
}

const COOKWARE_QUERY = `query Cookware($kitchenSlug: String) { cookware(kitchenSlug: $kitchenSlug) { id name brand tags notes } }`;
const ADD_COOKWARE = `mutation AddCookware($name: String!, $brand: String, $tags: [String!], $notes: String, $kitchenSlug: String) { addCookware(name: $name, brand: $brand, tags: $tags, notes: $notes, kitchenSlug: $kitchenSlug) { id } }`;
const UPDATE_COOKWARE = `mutation UpdateCookware($id: String!, $name: String, $brand: String, $tags: [String!], $notes: String) { updateCookware(id: $id, name: $name, brand: $brand, tags: $tags, notes: $notes) { id } }`;
const DELETE_COOKWARE = `mutation DeleteCookware($id: String!) { deleteCookware(id: $id) }`;

interface Props { kitchen: string; }

function cookwareDetailHref(kitchen: string, id: string) {
  return `/kitchens/${kitchen}/cookware/${id}#stage`;
}

export default function CookwarePage({ kitchen }: Props) {
  const [cookware, setCookware] = useState<Cookware[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [owner, setOwner] = useState(false);

  useEffect(() => { setOwner(isOwner()); }, []);

  async function refresh() {
    const data = await gql<{ cookware: Cookware[] }>(COOKWARE_QUERY, { kitchenSlug: kitchen });
    setCookware(data.cookware);
  }

  useEffect(() => { refresh(); }, [kitchen]);

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await gql(DELETE_COOKWARE, { id });
      await refresh();
    } finally {
      setDeleting(false);
      setDeleteConfirm(null);
    }
  }

  return (
    <>
      <Head><title>Cookware — Pantry Host</title></Head>

      <datalist id="common-cookware">
        {COMMON_COOKWARE.map((c) => <option key={c} value={c} />)}
      </datalist>

      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-4xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-4xl font-bold">Cookware</h1>
          {owner && (
            <button type="button" onClick={() => { setShowForm(!showForm); setEditingId(null); }} aria-expanded={showForm} aria-controls="add-cookware-form" className="btn-primary">
              {showForm ? 'Cancel' : '+ Add Cookware'}
            </button>
          )}
        </div>

        {showForm && (
          <section id="add-cookware-form" aria-label="Add cookware" className="mb-8 p-6 border border-[var(--color-border-card)] bg-[var(--color-bg-card)]">
            <h2 className="text-lg font-bold mb-4">Add Cookware</h2>
            <CookwareForm kitchenSlug={kitchen} onSave={async () => { setShowForm(false); await refresh(); }} onCancel={() => setShowForm(false)} />
          </section>
        )}

        {cookware.length === 0 && !showForm && (
          <div className="text-center py-20 text-[var(--color-text-secondary)]">
            <p className="text-lg mb-2">No cookware registered yet.</p>
            <p>Adding your equipment helps AI suggest better recipes.</p>
          </div>
        )}

        <ul role="list" className="divide-y divide-[var(--color-border-card)]">
          {cookware.map((item) => (
            <li key={item.id}>
              {editingId === item.id ? (
                <div className="py-4 bg-[var(--color-bg-card)] px-2">
                  <CookwareForm cookware={item} onSave={async () => { setEditingId(null); await refresh(); }} onCancel={() => setEditingId(null)} autoFocus />
                </div>
              ) : (
                <div className="flex items-center gap-3 py-4">
                  <div className="flex-1 min-w-0">
                    <a href={cookwareDetailHref(kitchen, item.id)} id={`cw-${item.id}`} className="font-semibold hover:text-accent transition-colors">{item.name}</a>
                    {item.brand && <span className="ml-2 text-sm text-[var(--color-text-secondary)]">{item.brand}</span>}
                    {item.tags.length > 0 && (
                      <span className="ml-2">{item.tags.map((t) => <span key={t} className="tag mr-1">{t}</span>)}</span>
                    )}
                  </div>
                  {owner && (
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => setEditingId(item.id)} aria-label="Edit" aria-describedby={`cw-${item.id}`} className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-2">
                        <PencilSimple size={16} aria-hidden />
                      </button>
                      {deleteConfirm === item.id ? (
                        <div className="flex gap-1 items-center">
                          <span className="text-xs text-[var(--color-text-secondary)] mr-1">Delete?</span>
                          <button type="button" autoFocus onClick={() => handleDelete(item.id)} disabled={deleting} aria-label="Confirm delete" aria-describedby={`cw-${item.id}`} className="btn-danger text-xs px-2 py-1">Yes</button>
                          <button type="button" onClick={() => setDeleteConfirm(null)} aria-label="Cancel delete" aria-describedby={`cw-${item.id}`} className="btn-secondary text-xs px-2 py-1">No</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setDeleteConfirm(item.id)} aria-label="Delete" aria-describedby={`cw-${item.id}`} className="text-[var(--color-text-secondary)] hover:text-red-500 p-2">
                          <Trash size={16} aria-hidden />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      </main>
    </>
  );
}

interface FormProps { cookware?: Cookware; onSave: () => void; onCancel?: () => void; kitchenSlug?: string; autoFocus?: boolean; }

function CookwareForm({ cookware, onSave, onCancel, kitchenSlug, autoFocus }: FormProps) {
  const editing = Boolean(cookware);
  const [name, setName] = useState(cookware?.name ?? '');
  const [brand, setBrand] = useState(cookware?.brand ?? '');
  const [tagInput, setTagInput] = useState(cookware?.tags?.join(', ') ?? '');
  const [notes, setNotes] = useState(cookware?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
    const mutation = editing && cookware ? UPDATE_COOKWARE : ADD_COOKWARE;
    const variables = editing && cookware
      ? { id: cookware.id, name: name.trim(), brand: brand || null, tags, notes: notes || null }
      : { name: name.trim(), brand: brand || null, tags, notes: notes || null, kitchenSlug: kitchenSlug ?? null };
    try {
      await gql(mutation, variables);
    } catch {
      enqueue(mutation, variables);
    }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} aria-label={editing ? 'Edit cookware' : 'Add cookware'} noValidate>
      <datalist id="common-cookware-form">{COMMON_COOKWARE.map((c) => <option key={c} value={c} />)}</datalist>
      <div className="mb-4">
        <label htmlFor="cw-name" className="field-label">Name <span aria-hidden="true" className="text-red-500">*</span></label>
        <input id="cw-name" type="text" list="common-cookware-form" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Instant Pot" className="field-input w-full" aria-required="true" autoFocus={autoFocus} />
      </div>
      <div className="mb-4">
        <label htmlFor="cw-brand" className="field-label">Brand</label>
        <input id="cw-brand" type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Instant Pot Co." className="field-input w-full" />
      </div>
      <div className="mb-4">
        <label htmlFor="cw-tags" className="field-label">Tags <span className="font-normal text-[var(--color-text-secondary)]">(comma-separated)</span></label>
        <input id="cw-tags" type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="e.g. pressure-cooker, slow-cooker" className="field-input w-full" />
      </div>
      <div className="mb-5">
        <label htmlFor="cw-notes" className="field-label">Notes <span className="font-normal text-[var(--color-text-secondary)]">(usage guide, composting rules, etc.)</span></label>
        <textarea id="cw-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Accepts fruit scraps, veggie scraps, eggshells. Does NOT accept meat, dairy, or oils." className="field-input w-full" rows={3} />
      </div>
      {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
      <div className="flex gap-3">
        <button type="submit" disabled={saving || !name.trim()} aria-busy={saving} className="btn-primary flex-1 disabled:opacity-50">
          {saving ? 'Saving…' : editing ? 'Save Changes' : 'Add Cookware'}
        </button>
        {onCancel && <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>}
      </div>
    </form>
  );
}

