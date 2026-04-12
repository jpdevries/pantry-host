import { BookOpen, Wine, ForkKnife, CookingPot, Leaf, Flask } from '@phosphor-icons/react';

/**
 * Community import sources marketing section.
 *
 * Showcases the six federated datasources available on the Import page.
 * Each card highlights the catalog size, a one-liner, and a standout
 * feature — enough to intrigue without overwhelming. Links out to the
 * source, not to the app.
 */

const sources = [
  {
    name: 'TheMealDB',
    href: 'https://www.themealdb.com/',
    icon: ForkKnife,
    catalog: '~300 recipes',
    blurb: 'Browse by category, cuisine, or ingredient. Every recipe includes a YouTube video link.',
    highlight: 'Open API, no key required',
  },
  {
    name: 'Cooklang Federation',
    href: 'https://cooklang.org/',
    icon: BookOpen,
    catalog: '~60 federated feeds, 3,500+ recipes',
    blurb: 'Community recipes in the standardized .cook format, with per-step photos auto-discovered from GitHub.',
    highlight: 'Difficulty ratings + step photos',
  },
  {
    name: 'Wikibooks Cookbook',
    href: 'https://en.wikibooks.org/wiki/Cookbook',
    icon: Leaf,
    catalog: '~3,900 recipes',
    blurb: 'The largest catalog of the six. Cached locally on first fetch for offline browsing.',
    highlight: 'CC-BY-SA 4.0, offline-capable',
  },
  {
    name: 'Public Domain Recipes',
    href: 'https://publicdomainrecipes.com/',
    icon: CookingPot,
    catalog: '408 recipes (bundled)',
    blurb: 'Truly public domain — no attribution required. Instant client-side search with zero API calls.',
    highlight: 'Unlicense, ships with the app',
  },
  {
    name: 'Recipe API',
    href: 'https://recipe-api.com/',
    icon: Flask,
    catalog: 'Proprietary catalog',
    blurb: 'USDA-backed nutrition data per serving, structured instructions with doneness cues, and dietary flags.',
    highlight: 'Free tier: 100 req/day',
  },
  {
    name: 'TheCocktailDB',
    href: 'https://www.thecocktaildb.com/',
    icon: Wine,
    catalog: '~600 cocktails',
    blurb: 'Drinks-only companion to TheMealDB. Glass type metadata and age-gated inside Pantry\u00a0Host.',
    highlight: 'Open API, opt-in via Settings',
  },
];

export default function ImportSources() {
  return (
    <section id="import-sources" className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex justify-center mb-4 opacity-60">
        <BookOpen size={32} weight="light" />
      </div>
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
        Import from Community&nbsp;Sources
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] text-sm sm:text-base max-w-2xl mx-auto mb-12 leading-relaxed pretty">
        Import from recipe communities directly inside the&nbsp;app. Every imported recipe is stored locally on your hardware and works&nbsp;offline&nbsp;&mdash; even if the original source goes&nbsp;away.
      </p>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {sources.map((s) => (
          <a
            key={s.name}
            href={s.href}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5 flex flex-col hover:border-[var(--color-accent)] transition-colors"
          >
            <div className="flex items-center gap-2 mb-3">
              <s.icon size={20} weight="light" className="opacity-60 shrink-0" />
              <h3 className="text-lg font-bold">{s.name}</h3>
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-accent)] mb-2">
              {s.catalog}
            </p>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed flex-1 pretty">
              {s.blurb}
            </p>
            <p className="text-xs text-[var(--color-text-secondary)] mt-3 pt-3 border-t border-[var(--color-border-card)]">
              {s.highlight}
            </p>
          </a>
        ))}
      </div>

      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8 max-w-2xl mx-auto pretty">
        Pantry&nbsp;Host has no commercial relationship with any of these sources. Each is integrated as a community&nbsp;good.
      </p>
    </section>
  );
}
