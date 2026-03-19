import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import { cacheGet, cacheSet } from '@/lib/cache';
import MenuCard from '@/components/MenuCard';

interface MenuSummary {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  active: boolean;
  recipes: { id: string }[];
}

const MENUS_QUERY = `query Menus($kitchenSlug: String) { menus(kitchenSlug: $kitchenSlug) { id slug title description active recipes { id } } }`;

interface Props {
  kitchen: string;
}

export default function MenusIndexPage({ kitchen }: Props) {
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isDev, setIsDev] = useState(false);
  const menusBase = kitchen === 'home' ? '/menus' : `/kitchens/${kitchen}/menus`;
  const slug = kitchen === 'home' ? undefined : kitchen;
  const cacheKey = `cache:menus:${kitchen}`;

  useEffect(() => {
    setIsDev(window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');
    const cached = cacheGet<MenuSummary[]>(cacheKey);
    if (cached) { setMenus(cached); setLoading(false); }
    gql<{ menus: MenuSummary[] }>(MENUS_QUERY, { kitchenSlug: slug })
      .then((d) => { setMenus(d.menus); cacheSet(cacheKey, d.menus); setLoading(false); })
      .catch(() => { if (!cached) setLoading(false); });
  }, [kitchen]);

  const MENU_ORDER: Record<string, number> = { 'breakfast': 0, 'lunch': 1, 'dinner': 2, 'pizza night': 3 };

  function menuSort(a: MenuSummary, b: MenuSummary): number {
    const aOrder = MENU_ORDER[a.title.toLowerCase()] ?? 100;
    const bOrder = MENU_ORDER[b.title.toLowerCase()] ?? 100;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return a.title.localeCompare(b.title);
  }

  const q = search.toLowerCase();
  const visibleMenus = isDev ? menus : menus.filter((m) => m.active);
  const sorted = [...visibleMenus].sort(menuSort);
  const filtered = q
    ? sorted.filter((m) => m.title.toLowerCase().includes(q))
    : sorted;

  return (
    <main id="stage" className="min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Menus</h1>
        {isDev && (
          <a href={`${menusBase}/new`} className="btn-primary text-sm">+ New Menu</a>
        )}
      </div>

      {menus.length > 3 && (
        <input
          type="search"
          placeholder="Search menus..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-6 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
        />
      )}

      {loading && menus.length === 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-5 bg-zinc-200 dark:bg-zinc-700 rounded w-3/4 mb-2" />
              <div className="h-4 bg-zinc-200 dark:bg-zinc-700 rounded w-full mb-1" />
              <div className="h-3 bg-zinc-200 dark:bg-zinc-700 rounded w-1/4 mt-2" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-center py-12">
          {search ? 'No menus match your search.' : 'No menus yet. Create your first one!'}
        </p>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((m) => (
            <MenuCard key={m.id} menu={m} menusBase={menusBase} />
          ))}
        </div>
      )}
    </main>
  );
}
