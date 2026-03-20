import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import { cacheGet, cacheSet } from '@/lib/cache';
import { MENU_CATEGORIES, MENU_CATEGORY_ORDER } from '@/lib/constants';
import MenuCard from '@/components/MenuCard';

interface MenuSummary {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  active: boolean;
  category: string | null;
  recipes: { id: string; recipe: { title: string; tags: string[] } }[];
}

const MENUS_QUERY = `query Menus($kitchenSlug: String) { menus(kitchenSlug: $kitchenSlug) { id slug title description active category recipes { id recipe { title tags } } } }`;

interface Props {
  kitchen: string;
}

/** Sort order for menus within the Daily category */
const DAILY_ORDER: Record<string, number> = { 'breakfast': 0, 'lunch': 1, 'dinner': 2, 'diner': 3 };

function categoryLabel(cat: string): string {
  return MENU_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
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

  const q = search.toLowerCase();
  const visibleMenus = isDev ? menus : menus.filter((m) => m.active);
  const filtered = q
    ? visibleMenus.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        m.recipes.some((mr) =>
          mr.recipe.title.toLowerCase().includes(q) ||
          mr.recipe.tags.some((t) => t.toLowerCase().includes(q))
        )
      )
    : visibleMenus;

  // Group menus by category
  const groups = new Map<string, MenuSummary[]>();
  for (const m of filtered) {
    const cat = m.category ?? '_uncategorized';
    if (!groups.has(cat)) groups.set(cat, []);
    groups.get(cat)!.push(m);
  }

  // Sort groups by MENU_CATEGORY_ORDER (uncategorized last)
  const sortedGroups = [...groups.entries()].sort(([a], [b]) => {
    const aOrder = a === '_uncategorized' ? 999 : (MENU_CATEGORY_ORDER[a] ?? 998);
    const bOrder = b === '_uncategorized' ? 999 : (MENU_CATEGORY_ORDER[b] ?? 998);
    return aOrder - bOrder;
  });

  // Sort menus within each group
  for (const [cat, items] of sortedGroups) {
    if (cat === 'daily') {
      items.sort((a, b) => {
        const aOrder = DAILY_ORDER[a.title.toLowerCase()] ?? 100;
        const bOrder = DAILY_ORDER[b.title.toLowerCase()] ?? 100;
        if (aOrder !== bOrder) return aOrder - bOrder;
        return a.title.localeCompare(b.title);
      });
    } else {
      items.sort((a, b) => a.title.localeCompare(b.title));
    }
  }

  const totalFiltered = sortedGroups.reduce((sum, [, items]) => sum + items.length, 0);

  return (
    <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
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
          className="w-full mb-6 px-4 py-2 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
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
      ) : totalFiltered === 0 ? (
        <p className="text-zinc-500 dark:text-zinc-400 text-center py-12">
          {search ? 'No menus match your search.' : 'No menus yet. Create your first one!'}
        </p>
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(([cat, items]) => (
            <section key={cat}>
              {cat !== '_uncategorized' && (
                <h2 className="text-lg font-semibold text-zinc-500 dark:text-zinc-400 uppercase tracking-wider mb-3">
                  {categoryLabel(cat)}
                </h2>
              )}
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((m) => (
                  <MenuCard key={m.id} menu={m} menusBase={menusBase} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
