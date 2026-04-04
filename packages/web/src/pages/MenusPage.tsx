import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { Trash } from '@phosphor-icons/react';
import { MENU_CATEGORIES } from '@pantry-host/shared/constants';

interface MenuRecipe {
  id: string;
  recipe: { title: string };
}

interface Menu {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  active: boolean;
  category: string | null;
  recipes: MenuRecipe[];
}

const QUERY = `{ menus { id slug title description active category recipes { id recipe { title } } } }`;

export default function MenusPage() {
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function load() {
    const { menus: list } = await gql<{ menus: Menu[] }>(QUERY);
    setMenus(list);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleDelete(id: string) {
    await gql(`mutation($id: String!) { deleteMenu(id: $id) }`, { id });
    setDeleteConfirm(null);
    load();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Menus</h1>
        <Link to="/menus/new" className="btn-primary">+ New Menu</Link>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-[var(--color-bg-card)] animate-pulse" />
          ))}
        </div>
      ) : menus.length === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-sm">
          No menus yet. Menus let you organize recipes into courses and meal plans.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {menus.map((menu) => (
            <div key={menu.id} className="card rounded-xl p-4 relative group">
              <Link to={`/menus/${menu.slug || menu.id}`} className="block hover:underline">
                <h3 className="font-bold text-base">{menu.title}</h3>
                {menu.description && (
                  <p className="text-sm text-[var(--color-text-secondary)] mt-1 line-clamp-2">{menu.description}</p>
                )}
              </Link>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {menu.recipes.length} recipe{menu.recipes.length !== 1 ? 's' : ''}
                </span>
                {menu.category && <span className="tag">{menu.category}</span>}
                {!menu.active && <span className="tag">inactive</span>}
              </div>
              <div className="absolute top-3 right-3 flex gap-1">
                <Link
                  to={`/menus/${menu.slug || menu.id}/edit`}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1 text-xs"
                >
                  Edit
                </Link>
                {deleteConfirm === menu.id ? (
                  <div className="flex gap-1 items-center">
                    <button type="button" autoFocus onClick={() => handleDelete(menu.id)} className="btn-danger text-xs px-2 py-0.5" style={{ minHeight: 'auto' }}>Yes</button>
                    <button type="button" onClick={() => setDeleteConfirm(null)} className="btn-secondary text-xs px-2 py-0.5" style={{ minHeight: 'auto' }}>No</button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setDeleteConfirm(menu.id)}
                    className="text-[var(--color-text-secondary)] hover:text-red-500 p-1"
                    aria-label={`Delete ${menu.title}`}
                  >
                    <Trash size={14} aria-hidden />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
