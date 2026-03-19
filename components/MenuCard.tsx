interface Menu {
  id: string;
  slug: string | null;
  title: string;
  description: string | null;
  recipes: { id: string }[];
}

interface Props {
  menu: Menu;
  menusBase?: string;
}

export default function MenuCard({ menu, menusBase = '/menus' }: Props) {
  const count = menu.recipes.length;
  return (
    <a
      href={`${menusBase}/${menu.slug ?? menu.id}#stage`}
      className="card group overflow-hidden block hover:ring-1 hover:ring-amber-500 dark:hover:ring-amber-400 transition-all"
    >
      <div className="p-4">
        <span className="font-bold text-base leading-snug group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
          {menu.title}
        </span>
        {menu.description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2 pretty">{menu.description}</p>
        )}
        <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2">
          {count} {count === 1 ? 'recipe' : 'recipes'}
        </p>
      </div>
    </a>
  );
}
