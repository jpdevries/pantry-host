import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { gql } from '@/lib/gql';

interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  tags: string[];
  photoUrl: string | null;
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
      recipes { id slug title cookTime prepTime servings tags photoUrl }
    }
  }
`;

const UPDATE_MUTATION = `
  mutation UpdateCookware($id: String!, $name: String!, $brand: String, $tags: [String!], $notes: String) {
    updateCookware(id: $id, name: $name, brand: $brand, tags: $tags, notes: $notes) { id }
  }
`;

export default function CookwareDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [item, setItem] = useState<CookwareItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  function load() {
    if (!id) return;
    gql<{ cookwareItem: CookwareItem | null }>(COOKWARE_ITEM_QUERY, { id })
      .then((d) => setItem(d.cookwareItem))
      .catch(console.error)
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [id]);

  if (loading) return <div className="h-40 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />;
  if (!item) return <p className="text-[var(--color-text-secondary)]">Cookware item not found.</p>;

  return (
    <div>
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 pb-4 mb-6 border-b" style={{ borderColor: 'var(--color-border-card)' }}>
        <Link to="/cookware#stage" className="text-sm text-[var(--color-text-secondary)] hover:underline">
          &larr; Cookware
        </Link>
        <button
          type="button"
          onClick={() => setEditing(!editing)}
          className="btn-secondary text-sm"
        >
          {editing ? 'Cancel' : 'Edit'}
        </button>
      </div>

      {editing ? (
        <EditForm
          item={item}
          onSave={() => { setEditing(false); setLoading(true); load(); }}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          <h1 className="text-3xl font-bold mb-1">{item.name}</h1>
          {item.brand && (
            <p className="text-[var(--color-text-secondary)]">{item.brand}</p>
          )}
          {item.tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {item.tags.map((t) => (
                <span key={t} className="tag">{t}</span>
              ))}
            </div>
          )}
          {item.notes && (
            <p className="mt-4 text-sm text-[var(--color-text-secondary)] whitespace-pre-line">{item.notes}</p>
          )}
        </>
      )}

      <section className="mt-8">
        <h2 className="text-xl font-bold mb-4">Recipes using this cookware</h2>

        {item.recipes.length === 0 ? (
          <p className="text-[var(--color-text-secondary)] text-sm">No recipes require this cookware yet.</p>
        ) : (
          <ul className="space-y-2">
            {item.recipes.map((r) => (
              <li key={r.id}>
                <Link
                  to={`/recipes/${r.slug}#stage`}
                  className="block card rounded-xl p-4 hover:underline"
                >
                  <span className="font-semibold text-sm">{r.title}</span>
                  <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
                    {[
                      r.prepTime && `${r.prepTime}m prep`,
                      r.cookTime && `${r.cookTime}m cook`,
                      r.servings && `${r.servings} servings`,
                    ].filter(Boolean).join(' · ')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
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
    <form onSubmit={handleSubmit} className="space-y-4">
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
