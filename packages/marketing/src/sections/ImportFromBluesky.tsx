/**
 * "Import from Bluesky" section — sits between the "Share to Bluesky"
 * teaser and the Community Sources grid. Markets the live import
 * functionality for both recipes and menus via AT Protocol.
 */

const BLUESKY_VIEWBOX = '0 0 600 530';
const BLUESKY_PATH =
  'M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z';

export default function ImportFromBluesky() {
  return (
    <section id="import-bluesky" className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex justify-center mb-4 opacity-60">
        <svg fill="currentColor" viewBox={BLUESKY_VIEWBOX} width={36} height={32} aria-hidden="true">
          <path d={BLUESKY_PATH} />
        </svg>
      </div>
      <p className="text-center text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
        Available now
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
        Import from&nbsp;Bluesky
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] text-sm sm:text-base max-w-2xl mx-auto mb-12 leading-relaxed pretty">
        Browse and import recipes and menus shared via the <code className="text-xs">exchange.recipe.recipe</code> and <code className="text-xs">collection</code> AT&nbsp;Protocol lexicons&nbsp;&mdash; from Bluesky, <a href="https://recipe.exchange/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-accent)]">recipe.exchange</a>, or any compatible&nbsp;client.
      </p>

      <div className="grid sm:grid-cols-2 gap-6 max-w-3xl mx-auto">
        <a href="https://my.pantryhost.app/recipes/feeds/bluesky" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-6 flex items-start gap-4 hover:border-[var(--color-accent)] transition-colors">
          <svg fill="currentColor" viewBox={BLUESKY_VIEWBOX} width={24} height={21} aria-hidden="true" className="shrink-0 opacity-60 mt-1">
            <path d={BLUESKY_PATH} />
          </svg>
          <div>
            <h3 className="text-lg font-bold mb-1">Browse recipes</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pretty">
              Discover community recipes shared on AT&nbsp;Protocol. Search by title, filter by category and cuisine, and import with one&nbsp;tap.
            </p>
          </div>
        </a>
        <a href="https://my.pantryhost.app/menus/feeds/bluesky" target="_blank" rel="noopener noreferrer" className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-6 flex items-start gap-4 hover:border-[var(--color-accent)] transition-colors">
          <div className="shrink-0 opacity-60 relative w-[24px] h-[21px] mt-1">
            <svg fill="currentColor" viewBox={BLUESKY_VIEWBOX} width={14} height={12} aria-hidden="true" className="absolute top-0 left-0"><path d={BLUESKY_PATH} /></svg>
            <svg fill="currentColor" viewBox={BLUESKY_VIEWBOX} width={10} height={9} aria-hidden="true" className="absolute top-[5px] right-0"><path d={BLUESKY_PATH} /></svg>
            <svg fill="currentColor" viewBox={BLUESKY_VIEWBOX} width={9} height={8} aria-hidden="true" className="absolute bottom-0 left-[3px]"><path d={BLUESKY_PATH} /></svg>
          </div>
          <div>
            <h3 className="text-lg font-bold mb-1">Browse menus</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pretty">
              Import curated recipe collections from the community. One click imports the menu and all its&nbsp;recipes.
            </p>
          </div>
        </a>
      </div>

      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8 max-w-2xl mx-auto pretty">
        Recipe data is fetched live from each author&rsquo;s Personal Data&nbsp;Server.
      </p>
    </section>
  );
}
