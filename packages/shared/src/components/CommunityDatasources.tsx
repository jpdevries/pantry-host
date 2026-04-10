/**
 * "About the community datasources" educational section.
 *
 * Rendered at the bottom of /recipes/import on both packages, below all
 * tab content and above the page-level Footer (units column). Single
 * shared component so the content stays consistent across packages and
 * a single edit propagates everywhere.
 *
 * Items annotated `(verify)` in DATASOURCES are best-guess from
 * external research and should be sanity-checked manually before
 * shipping. Everything else came directly from the codebase or vendor
 * docs we already cite.
 */

interface DatasourceInfo {
  key: 'mealdb' | 'cocktaildb' | 'cooklang' | 'publicdomain' | 'wikibooks' | 'recipe-api';
  name: string;
  href: string;
  maintainer: string;
  catalog: string;
  license: string;
  authBlurb: string;
  standout: string[];
}

const DATASOURCES: DatasourceInfo[] = [
  {
    key: 'mealdb',
    name: 'TheMealDB',
    href: 'https://www.themealdb.com/',
    maintainer: 'TheMealDB community',
    catalog: '~300 recipes (free tier)', // (verify)
    license: 'Per-recipe attribution', // (verify)
    authBlurb: 'None — open API',
    standout: [
      'Category & area filters',
      'YouTube video links per recipe',
      'Up to 20 ingredients per recipe',
    ],
  },
  {
    key: 'publicdomain',
    name: 'Public Domain Recipes',
    href: 'https://publicdomainrecipes.com/',
    maintainer: 'Ronald L. (ronaldl29)',
    catalog: '408 recipes (bundled)',
    license: 'Public domain (Unlicense)',
    authBlurb: 'None — fetched from GitHub raw',
    standout: [
      'Truly public domain — no attribution required',
      'Instant client-side search; zero API calls',
      'WebP images',
    ],
  },
  {
    key: 'recipe-api',
    name: 'Recipe API',
    href: 'https://recipe-api.com/',
    maintainer: 'recipe-api.com',
    catalog: '(proprietary, unspecified)',
    license: 'Proprietary',
    authBlurb: 'API key required (rapi_*); free tier 100/day, 10/min',
    standout: [
      '32 USDA-backed nutrients per serving (borrowed display, never stored)',
      'Structured instructions with doneness cues',
      'Ingredient substitutions, equipment & storage lists, dietary flags',
    ],
  },
  {
    key: 'cooklang',
    name: 'Cooklang Federation',
    href: 'https://cooklang.org/',
    maintainer: 'Cooklang community',
    catalog: '~60 federated feeds, 3,500+ recipes',
    license: 'Per-recipe (mostly CC-BY-SA)',
    authBlurb: 'None — open API, ~60 req/min',
    standout: [
      'Standardized .cook recipe format',
      'Per-step photos auto-discovered from GitHub raw URLs',
      'Difficulty ratings; active vs passive time',
    ],
  },
  {
    key: 'wikibooks',
    name: 'Wikibooks Cookbook',
    href: 'https://en.wikibooks.org/wiki/Cookbook',
    maintainer: 'Wikimedia Foundation (via gossminn/wikibooks-cookbook HF dataset)',
    catalog: '~3,900 recipes',
    license: 'CC-BY-SA 4.0 (attribution required)',
    authBlurb: 'None',
    standout: [
      'Largest catalog of the six',
      'Offline-capable — cached in-app on first fetch',
      'Structured Wikibooks taxonomy categories; difficulty 1–5',
    ],
  },
  {
    key: 'cocktaildb',
    name: 'TheCocktailDB',
    href: 'https://www.thecocktaildb.com/',
    maintainer: 'Same team as TheMealDB',
    catalog: '~600 cocktails', // (verify)
    license: 'Per-recipe attribution', // (verify)
    authBlurb: 'None — open API',
    standout: [
      'Alcoholic drink-only focus',
      'Glass type metadata',
      'Age-gated (21+) inside Pantry Host; can be hidden via Settings',
    ],
  },
];

export default function CommunityDatasources() {
  return (
    <section
      aria-labelledby="community-datasources-heading"
      className="mt-12 border-t border-[var(--color-border-card)] pt-8"
    >
      <h2
        id="community-datasources-heading"
        className="text-2xl font-bold mb-3"
      >
        About the Community Datasources
      </h2>
      <p className="text-sm text-[var(--color-text-secondary)] mb-6 legible pretty max-w-prose">
        Pantry Host integrates with six federated recipe sources, each with its own
        strengths and tradeoffs. None of them are operated by Pantry Host — when
        you import, your local pantry gets a copy and the original source can go
        away without affecting your data.
      </p>

      {/* Responsive card grid: 1 col mobile → 2 sm → 3 lg → 4 xl */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {DATASOURCES.map((d) => (
          <article
            key={d.key}
            role="region"
            aria-labelledby={`ds-card-${d.key}`}
            className="card p-4"
          >
            <h3 id={`ds-card-${d.key}`} className="font-semibold mb-2">
              <a
                href={d.href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-[var(--color-accent)]"
              >
                {d.name}
              </a>
            </h3>
            <dl className="text-xs grid gap-2 text-[var(--color-text-secondary)]">
              <div>
                <dt className="inline font-semibold text-[var(--color-text-primary)]">Maintainer: </dt>
                <dd className="inline">{d.maintainer}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[var(--color-text-primary)]">Catalog: </dt>
                <dd className="inline">{d.catalog}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[var(--color-text-primary)]">License: </dt>
                <dd className="inline">{d.license}</dd>
              </div>
              <div>
                <dt className="inline font-semibold text-[var(--color-text-primary)]">Auth &amp; free tier: </dt>
                <dd className="inline">{d.authBlurb}</dd>
              </div>
              <div>
                <dt className="font-semibold text-[var(--color-text-primary)] mb-1">Standout features:</dt>
                <dd>
                  <ul className="list-disc pl-5 space-y-1">
                    {d.standout.map((s) => (
                      <li key={s}>{s}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            </dl>
          </article>
        ))}
      </div>

      <p className="text-xs italic text-[var(--color-text-secondary)] mt-6 max-w-prose pretty">
        Pantry Host has no commercial relationship with any of these sources —
        each is integrated as a community good. If a source is missing what you
        need or has been mis-described,{' '}
        <a
          href="https://github.com/jpdevries/pantry-host/issues"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          open an issue
        </a>
        .
      </p>
    </section>
  );
}
