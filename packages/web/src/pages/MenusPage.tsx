import { useState, useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { gql } from '@/lib/gql';
import { PencilSimple, Trash } from '@phosphor-icons/react';
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

const QUERY = `
  query Menus($kitchenSlug: String) {
    menus(kitchenSlug: $kitchenSlug) { id slug title description active category recipes { id recipe { title } } }
  }
`;

export default function MenusPage() {
  const kitchen = useParams<{ kitchen?: string }>().kitchen ?? 'home';
  const base = kitchen === 'home' ? '' : `/kitchens/${kitchen}`;
  const [menus, setMenus] = useState<Menu[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function load() {
    const { menus: list } = await gql<{ menus: Menu[] }>(QUERY, { kitchenSlug: kitchen });
    setMenus(list);
    setLoading(false);
  }

  useEffect(() => { setLoading(true); load(); }, [kitchen]);

  async function handleDelete(id: string) {
    await gql(`mutation($id: String!) { deleteMenu(id: $id) }`, { id });
    setDeleteConfirm(null);
    load();
  }

  return (
    <div>
      <Link to={`${base}/menus/feeds/bluesky`} className="mb-6 flex items-center gap-4 card p-4 rounded-xl hover:border-[var(--color-accent)] transition-colors">
        <svg fill="currentColor" viewBox="0 0 600 530" width={32} height={28} aria-hidden="true" className="shrink-0 opacity-60" xmlns="http://www.w3.org/2000/svg">
          <path d="M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Browse menus from Bluesky</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Import curated recipe collections shared on AT Protocol</p>
        </div>
      </Link>

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h1 className="text-3xl font-bold">Menus</h1>
        <Link to={`${base}/menus/new#stage`} className="btn-primary">+ New Menu</Link>
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
              <Link to={`${base}/menus/${menu.slug || menu.id}#stage`} className="block hover:underline">
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
                  to={`${base}/menus/${menu.slug || menu.id}/edit#stage`}
                  className="text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] p-1"
                  aria-label={`Edit ${menu.title}`}
                >
                  <PencilSimple size={14} aria-hidden />
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
                    className="text-[var(--color-text-secondary)] btn-delete p-1"
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
