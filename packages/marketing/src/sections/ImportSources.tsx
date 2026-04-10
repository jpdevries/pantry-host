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
    catalog: 'Hundreds of federated repos',
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
    highlight: 'Open API, hideable via Settings',
  },
];

export default function ImportSources() {
  return (
    <section id="import-sources" className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex justify-center mb-4 opacity-60">
        <BookOpen size={32} weight="light" />
      </div>
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
        Six Community&nbsp;Sources
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] text-sm sm:text-base max-w-2xl mx-auto mb-12 leading-relaxed pretty">
        Import from federated recipe communities directly inside the&nbsp;app. Every imported recipe becomes yours&nbsp;&mdash; stored locally, editable, and independent of the original&nbsp;source.
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

      {/* Bluesky tie-back — centered in the middle column on desktop */}
      <a
        href="#atproto"
        className="mt-6 rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5 flex items-center gap-4 hover:border-[var(--color-accent)] transition-colors block lg:w-1/2 lg:mx-auto"
      >
        <svg
          fill="currentColor"
          viewBox="0 0 600 530"
          width={28}
          height={25}
          aria-hidden="true"
          className="opacity-60 shrink-0"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d="M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z" fillRule="evenodd" clipRule="evenodd" />
        </svg>
        <div>
          <p className="font-bold">Plus Bluesky</p>
          <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pretty">
            Import any recipe shared via the <code className="text-xs">exchange.recipe.recipe</code> AT&nbsp;Protocol lexicon&nbsp;&mdash; from Bluesky, <a href="https://recipe.exchange/" target="_blank" rel="noopener noreferrer" className="underline">recipe.exchange</a>, or any compatible&nbsp;client.
          </p>
        </div>
      </a>

      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8 max-w-2xl mx-auto pretty">
        Pantry&nbsp;Host has no commercial relationship with any of these sources. Each is integrated as a community&nbsp;good.
      </p>
    </section>
  );
}
