import Head from 'next/head';
import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';

interface Kitchen {
  id: string;
  slug: string;
  name: string;
}

const KITCHENS_QUERY = `{ kitchens { id slug name } }`;
const CREATE_KITCHEN = `
  mutation CreateKitchen($slug: String!, $name: String!) {
    createKitchen(slug: $slug, name: $name) { id slug name }
  }
`;
const UPDATE_KITCHEN = `
  mutation UpdateKitchen($id: String!, $name: String!) {
    updateKitchen(id: $id, name: $name) { id slug name }
  }
`;
const DELETE_KITCHEN = `
  mutation DeleteKitchen($id: String!) {
    deleteKitchen(id: $id)
  }
`;

function toSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export default function KitchensPage() {
  const [kitchens, setKitchens] = useState<Kitchen[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugManual, setSlugManual] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function refresh() {
    const data = await gql<{ kitchens: Kitchen[] }>(KITCHENS_QUERY);
    setKitchens(data.kitchens);
  }

  useEffect(() => { refresh(); }, []);

  function handleNameChange(val: string) {
    setName(val);
    if (!slugManual) setSlug(toSlug(val));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !slug.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await gql(CREATE_KITCHEN, { slug: slug.trim(), name: name.trim() });
      setName(''); setSlug(''); setSlugManual(false); setShowForm(false);
      await refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  function startEdit(k: Kitchen) {
    setEditingId(k.id);
    setEditName(k.name);
    setEditError(null);
  }

  async function handleRename(e: React.FormEvent) {
    e.preventDefault();
    if (!editName.trim() || !editingId) return;
    setEditSaving(true);
    setEditError(null);
    try {
      await gql(UPDATE_KITCHEN, { id: editingId, name: editName.trim() });
      setEditingId(null);
      await refresh();
    } catch (err) {
      setEditError((err as Error).message);
      setEditSaving(false);
    }
  }

  async function handleDelete(id: string) {
    setDeleting(true);
    try {
      await gql(DELETE_KITCHEN, { id });
      setDeleteConfirm(null);
      await refresh();
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Head><title>Kitchens — Pantry Host</title></Head>
      <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-3xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <h1 className="text-4xl font-bold">Kitchens</h1>
          <button type="button" onClick={() => setShowForm(!showForm)} aria-expanded={showForm} className="btn-primary">
            {showForm ? 'Cancel' : '+ Add Kitchen'}
          </button>
        </div>

        {showForm && (
          <section aria-label="Add kitchen" className="mb-8 p-6 border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900">
            <h2 className="text-lg font-bold mb-4">Add Kitchen</h2>
            <form onSubmit={handleCreate} noValidate>
              <div className="mb-4">
                <label htmlFor="kitchen-name" className="field-label">Name <span aria-hidden="true" className="text-red-500">*</span></label>
                <input
                  id="kitchen-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => handleNameChange(e.target.value)}
                  placeholder="e.g. Grandma's"
                  className="field-input w-full"
                  aria-required="true"
                />
              </div>
              <div className="mb-5">
                <label htmlFor="kitchen-slug" className="field-label">
                  Slug <span className="font-normal text-zinc-500">(URL-friendly, lowercase)</span>
                </label>
                <input
                  id="kitchen-slug"
                  type="text"
                  required
                  value={slug}
                  onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }}
                  placeholder="e.g. grandmas"
                  pattern="[a-z0-9-]+"
                  className="field-input w-full font-mono"
                  aria-required="true"
                  aria-describedby="slug-hint"
                />
                <p id="slug-hint" className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  Used in URLs like <code>/kitchens/{slug || 'grandmas'}/recipes</code>
                </p>
              </div>
              {error && <p role="alert" className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}
              <div className="flex gap-3">
                <button type="submit" disabled={saving || !name.trim() || !slug.trim()} aria-busy={saving} className="btn-primary flex-1 md:flex-none disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create Kitchen'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setError(null); }} className="btn-secondary">Cancel</button>
              </div>
            </form>
          </section>
        )}

        <ul role="list" className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {kitchens.map((k) => {
            const isHome = k.slug === 'home';
            const base = isHome ? '' : `/kitchens/${k.slug}`;
            const isEditing = editingId === k.id;

            return (
              <li key={k.id} className="py-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  {isEditing ? (
                    <form onSubmit={handleRename} className="flex-1 flex gap-2 items-center flex-wrap" noValidate>
                      <input
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className="field-input flex-1"
                        aria-label="Kitchen name"
                        autoFocus
                      />
                      {editError && <p role="alert" className="w-full text-sm text-red-600 dark:text-red-400">{editError}</p>}
                      <button type="submit" disabled={editSaving || !editName.trim()} aria-busy={editSaving} className="btn-primary text-sm disabled:opacity-50">
                        {editSaving ? 'Saving…' : 'Save'}
                      </button>
                      <button type="button" onClick={() => setEditingId(null)} className="btn-secondary text-sm">Cancel</button>
                    </form>
                  ) : (
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-lg">{k.name}</span>
                      {isHome && <span className="text-xs font-medium text-accent">default</span>}
                      <span className="font-mono text-xs text-zinc-400 dark:text-zinc-500">/{k.slug}</span>
                    </div>
                  )}

                  {!isHome && !isEditing && (
                    <div className="flex gap-2 shrink-0">
                      <button type="button" onClick={() => startEdit(k)} className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 text-sm p-1" aria-label={`Rename ${k.name}`}>
                        Rename
                      </button>
                      {deleteConfirm === k.id ? (
                        <div className="flex gap-1 items-center">
                          <span className="text-xs text-zinc-500">Delete?</span>
                          <button type="button" onClick={() => handleDelete(k.id)} disabled={deleting} className="btn-danger text-xs px-2 py-1">Yes</button>
                          <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary text-xs px-2 py-1">No</button>
                        </div>
                      ) : (
                        <button type="button" onClick={() => setDeleteConfirm(k.id)} className="text-zinc-400 hover:text-red-500 text-sm p-1" aria-label={`Delete ${k.name}`}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {!isEditing && (
                  <div className="flex flex-wrap gap-2">
                    <a href={`${base}/recipes#stage`} className="btn-secondary text-sm">Recipes</a>
                    <a href={`${base}/ingredients#stage`} className="btn-secondary text-sm">Pantry</a>
                    <a href={`${base}/list#stage`} className="btn-secondary text-sm">List</a>
                    <a href={`${base}/cookware#stage`} className="btn-secondary text-sm">Cookware</a>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
