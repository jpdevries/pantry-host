import { useState, useEffect } from 'react';
import { gql } from '@/lib/gql';
import { cacheGet, cacheSet } from '@pantry-host/shared/cache';
import { MENU_CATEGORIES, MENU_CATEGORY_ORDER } from '@pantry-host/shared/constants';
import { isOwner } from '@/lib/isTrustedNetwork';
import { useKitchen } from '@/lib/kitchen-context';
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

/** Sort order for menus within the Daily category */
const DAILY_ORDER: Record<string, number> = { 'breakfast': 0, 'lunch': 1, 'dinner': 2 };

function categoryLabel(cat: string): string {
  return MENU_CATEGORIES.find((c) => c.value === cat)?.label ?? cat;
}

export default function MenusIndexPage() {
  const kitchen = useKitchen();
  const [menus, setMenus] = useState<MenuSummary[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [owner, setOwner] = useState(false);
  const menusBase = `/kitchens/${kitchen}/menus`;
  const slug = kitchen;
  const cacheKey = `cache:menus:${kitchen}`;

  useEffect(() => {
    setOwner(isOwner());
    const cached = cacheGet<MenuSummary[]>(cacheKey);
    if (cached) { setMenus(cached); setLoading(false); }
    gql<{ menus: MenuSummary[] }>(MENUS_QUERY, { kitchenSlug: slug })
      .then((d) => { setMenus(d.menus); cacheSet(cacheKey, d.menus); setLoading(false); })
      .catch(() => { if (!cached) setLoading(false); });
  }, [kitchen]);

  const q = search.toLowerCase();
  const visibleMenus = owner ? menus : menus.filter((m) => m.active);
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
      <a href={`${menusBase}/feeds/bluesky#stage`} className="mb-6 flex items-center gap-4 card p-4 rounded-xl hover:border-accent transition-colors">
        <svg fill="currentColor" viewBox="0 0 600 530" width={32} height={28} aria-hidden="true" className="shrink-0 opacity-60" xmlns="http://www.w3.org/2000/svg">
          <path d="M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z" />
        </svg>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm">Browse menus from Bluesky</p>
          <p className="text-xs text-[var(--color-text-secondary)]">Import curated recipe collections shared on AT Protocol</p>
        </div>
      </a>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Menus</h1>
        {owner && (
          <a href={`${menusBase}/new`} className="btn-primary text-sm">+ New Menu</a>
        )}
      </div>

      {menus.length > 3 && (
        <input
          type="search"
          placeholder="Search menus..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full mb-6 px-4 py-2 bg-body border border-[var(--color-border-card)] text-sm focus:outline-none focus:ring-2 focus:ring-accent"
        />
      )}

      {loading && menus.length === 0 ? (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-4 animate-pulse">
              <div className="h-5 bg-[var(--color-accent-subtle)] rounded w-3/4 mb-2" />
              <div className="h-4 bg-[var(--color-accent-subtle)] rounded w-full mb-1" />
              <div className="h-3 bg-[var(--color-accent-subtle)] rounded w-1/4 mt-2" />
            </div>
          ))}
        </div>
      ) : totalFiltered === 0 ? (
        <p className="text-[var(--color-text-secondary)] text-center py-12">
          {search ? 'No menus match your search.' : 'No menus yet. Create your first one!'}
        </p>
      ) : (
        <div className="space-y-8">
          {sortedGroups.map(([cat, items]) => (
            <section key={cat}>
              {cat !== '_uncategorized' && (
                <h2 className="text-lg font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-3">
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
