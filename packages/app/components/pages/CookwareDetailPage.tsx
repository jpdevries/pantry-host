import Head from 'next/head';
import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import RecipeCard from '@/components/RecipeCard';

interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  source: string;
  tags: string[];
  photoUrl: string | null;
  queued: boolean;
}

interface CookwareItem {
  id: string;
  name: string;
  brand: string | null;
  notes: string | null;
  tags: string[];
  recipes: Recipe[];
}

const COOKWARE_ITEM_QUERY = `
  query CookwareItem($id: String!) {
    cookwareItem(id: $id) {
      id name brand notes tags
      recipes { id slug title cookTime prepTime servings source tags photoUrl queued }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateCookware($id: String!, $name: String!, $brand: String, $tags: [String!], $notes: String) {
    updateCookware(id: $id, name: $name, brand: $brand, tags: $tags, notes: $notes) { id }
  }
`;

interface Props { id: string; kitchen: string; }

export default function CookwareDetailPage({ id, kitchen }: Props) {
  const [item, setItem] = useState<CookwareItem | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);

  const cookwareBase = kitchen === 'home' ? '/cookware' : `/kitchens/${kitchen}/cookware`;
  const recipesBase = kitchen === 'home' ? '/recipes' : `/kitchens/${kitchen}/recipes`;

  function load() {
    if (!id) return;
    gql<{ cookwareItem: CookwareItem | null }>(COOKWARE_ITEM_QUERY, { id })
      .then((d) => {
        if (d.cookwareItem) setItem(d.cookwareItem);
        else setNotFound(true);
      })
      .catch(console.error);
  }

  useEffect(() => { load(); }, [id]);

  return (
    <>
      <Head><title>{item ? `${item.name} — Cookware` : 'Cookware'} — Pantry Host</title></Head>

      <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-4xl mx-auto">
        {/* Action bar */}
        <div className="flex items-center justify-between gap-3 pb-4 mb-6 border-b" style={{ borderColor: 'var(--color-border-card)' }}>
          <a href={`${cookwareBase}#stage`} className="text-sm text-[var(--color-text-secondary)] hover:text-accent transition-colors">
            ← Cookware
          </a>
          {item && (
            <button
              type="button"
              onClick={() => setEditing(!editing)}
              className="btn-secondary text-sm"
            >
              {editing ? 'Cancel' : 'Edit'}
            </button>
          )}
        </div>

        {notFound && (
          <p className="text-[var(--color-text-secondary)]">Cookware item not found.</p>
        )}

        {item && (
          <>
            {editing ? (
              <EditForm
                item={item}
                onSave={() => { setEditing(false); load(); }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="mb-8">
                <h1 className="text-4xl font-bold mb-1">{item.name}</h1>
                {item.brand && (
                  <p className="text-[var(--color-text-secondary)]">{item.brand}</p>
                )}
                {item.tags.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {item.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                  </div>
                )}
                {item.notes && (
                  <p className="mt-4 text-sm text-[var(--color-text-secondary)] whitespace-pre-line legible pretty">{item.notes}</p>
                )}
              </div>
            )}

            <section aria-labelledby="recipes-heading">
              <h2 id="recipes-heading" className="text-xl font-bold mb-4">
                Recipes using this cookware
              </h2>

              {item.recipes.length === 0 ? (
                <p className="text-[var(--color-text-secondary)]">
                  No recipes require this cookware yet.
                </p>
              ) : (
                <ul role="list" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6">
                  {item.recipes.map((r) => (
                    <li key={r.id} className="grid grid-rows-[subgrid] row-span-4 mb-4">
                      <RecipeCard recipe={r} recipesBase={recipesBase} />
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </main>
    </>
  );
}

function EditForm({ item, onSave, onCancel }: { item: CookwareItem; onSave: () => void; onCancel: () => void }) {
  const [name, setName] = useState(item.name);
  const [brand, setBrand] = useState(item.brand ?? '');
  const [tagInput, setTagInput] = useState(item.tags.join(', '));
  const [notes, setNotes] = useState(item.notes ?? '');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
    try {
      await gql(UPDATE_MUTATION, { id: item.id, name: name.trim(), brand: brand || null, tags, notes: notes || null });
    } catch (err) {
      console.error(err);
    }
    onSave();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 mb-8">
      <div>
        <label htmlFor="cw-name" className="field-label">Name <span className="text-red-500">*</span></label>
        <input id="cw-name" type="text" required value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Instant Pot" className="field-input w-full" autoFocus />
      </div>
      <div>
        <label htmlFor="cw-brand" className="field-label">Brand</label>
        <input id="cw-brand" type="text" value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Instant Pot Co." className="field-input w-full" />
      </div>
      <div>
        <label htmlFor="cw-tags" className="field-label">Tags <span className="font-normal text-[var(--color-text-secondary)]">(comma-separated)</span></label>
        <input id="cw-tags" type="text" value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="e.g. pressure-cooker, slow-cooker" className="field-input w-full" />
      </div>
      <div>
        <label htmlFor="cw-notes" className="field-label">Notes <span className="font-normal text-[var(--color-text-secondary)]">(usage guide, composting rules, etc.)</span></label>
        <textarea id="cw-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Accepts fruit scraps, veggie scraps, eggshells. Does NOT accept meat, dairy, or oils." rows={3} className="field-input w-full" />
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving || !name.trim()} className="btn-primary disabled:opacity-50">{saving ? 'Saving\u2026' : 'Save Changes'}</button>
        <button type="button" onClick={onCancel} className="btn-secondary">Cancel</button>
      </div>
    </form>
  );
}
