import { useKitchen } from '@/lib/kitchen-context';
import BlueskyFeedBrowse from './BlueskyFeedBrowse';

const BLUESKY_VIEWBOX = '0 0 600 530';
const BLUESKY_PATH = 'M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z';

/**
 * Standalone Bluesky Recipes feed page — adds the page chrome (breadcrumb +
 * heading) around the shared <BlueskyFeedBrowse>. The same browse component is
 * embedded as the first tab of the Import page; this route stays alive for the
 * legacy deep links that used to land here.
 */
export default function BlueskyFeedsPage() {
  const kitchen = useKitchen();
  const recipesBase = `/kitchens/${kitchen}/recipes`;
  return (
    <main id="stage" className="max-sm:min-h-screen px-4 py-10 md:px-8 max-w-5xl mx-auto">
      <div className="mb-6">
        <a href={`${recipesBase}#stage`} className="text-sm text-[var(--color-text-secondary)] hover:text-accent transition-colors mb-4 inline-block">
          ← Your Recipes
        </a>
        <div className="flex items-center gap-3 mb-2">
          <svg fill="currentColor" viewBox={BLUESKY_VIEWBOX} width={28} height={24} aria-hidden="true" className="opacity-60 shrink-0">
            <path d={BLUESKY_PATH} />
          </svg>
          <h1 id="bluesky-recipes" className="text-4xl font-bold">Bluesky Recipes</h1>
        </div>
      </div>
      <BlueskyFeedBrowse />
    </main>
  );
}
