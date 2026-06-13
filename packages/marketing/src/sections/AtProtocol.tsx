import { LinkSimple, RssSimple, QrCode, IdentificationCard, Share, Globe } from '@phosphor-icons/react';

/**
 * AT Protocol federation section.
 *
 * Frames what's live today: at:// deep-linking, the feed.pantryhost.app
 * firehose indexer, and QR sharing. The one remaining milestone (one-tap
 * publish from Pantry Host back to the user's PDS) is noted as a single
 * muted "Coming next" line at the bottom — honest without burying the
 * shipped work.
 *
 * Visual style mirrors `Integrations.tsx` so the page reads as one
 * coherent story about open ecosystems.
 */

// Bluesky official butterfly mark. Native viewBox is 600x530-ish; the
// path uses negative Y values for the upper wings, so we need a viewBox
// that includes them or the top of the butterfly gets clipped.
const BLUESKY_VIEWBOX = '0 0 600 530';
const BLUESKY_PATH =
  'M135.72 44.03C202.216 93.951 273.74 195.17 299.91 249.49c26.17-54.32 97.694-155.539 164.19-205.46C512.18 8.005 590 -19.728 590 69.04c0 17.726-10.155 148.928-16.111 170.208-20.703 73.984-96.144 92.854-163.25 81.433 117.262 19.96 147.131 86.084 82.654 152.208-122.385 125.621-175.86-31.511-189.563-71.807-2.512-7.387-3.687-10.832-3.69-7.905-.003-2.927-1.179.518-3.69 7.905-13.704 40.296-67.18 197.428-189.563 71.807-64.477-66.124-34.61-132.251 82.65-152.208-67.105 11.421-142.548-7.45-163.25-81.433C20.232 217.968 10.077 86.766 10.077 69.04c0-88.768 77.82-61.035 125.9-25.01z';

// Sample AT URI used by the "Open by AT URI" tile to prove the deep-link
// path works. Stable because it's a `recipe.exchange` publisher we index.
const SAMPLE_AT_HREF = 'https://my.pantryhost.app/at/did:plc:7ojp52ncy5ay6ldsj3db6joj/exchange.recipe.recipe/01KKVFB0KTWVFXG493PZQG6T83#stage';

const liveTiles = [
  {
    title: 'Open by AT URI',
    icon: LinkSimple,
    href: SAMPLE_AT_HREF,
    description: (
      <>
        Visit <code className="text-xs">my.pantryhost.app/at/&#123;uri&#125;</code> &mdash; or paste <code className="text-xs">at://&hellip;</code> straight into the browser. The record resolves to a detail page you can read, QR-share, or import in one&nbsp;tap.
      </>
    ),
  },
  {
    title: 'Browse the feed',
    icon: RssSimple,
    href: 'https://my.pantryhost.app/recipes/feeds/bluesky',
    description: (
      <>
        <code className="text-xs">feed.pantryhost.app</code> indexes the AT firehose for <code className="text-xs">exchange.recipe.*</code> records and serves them as a paginated feed. No account, no sign-in, always up to&nbsp;date.
      </>
    ),
  },
  {
    title: 'Share via QR',
    icon: QrCode,
    description: (
      <>
        Every detail page has a Share button that opens a QR&nbsp;code &mdash; scan it from your phone to pick the recipe up where you left off, or hand it to a&nbsp;friend.
      </>
    ),
  },
];

const principles = [
  {
    title: 'Your records, your PDS',
    description:
      'Recipes you choose to share live on your own Personal Data Server — Bluesky-hosted by default, self-hostable if you want. Same philosophy as the rest of Pantry\u00a0Host.',
    icon: IdentificationCard,
  },
  {
    title: 'Two open lexicons',
    description:
      <>Pantry&nbsp;Host adopts the existing <code>exchange.recipe.recipe</code> and <code>exchange.recipe.collection</code> lexicons from <code>recipe.exchange</code>. Share individual recipes or entire menus&nbsp;&mdash; visible on every compatible&nbsp;client.</>,
    icon: Share,
  },
  {
    title: 'Federated',
    description:
      <>No <code>pantryhost.app/recipe/123</code> URL &mdash; by design. Recipes are addressable by AT&nbsp;URI and travel with your identity, not&nbsp;ours.</>,
    icon: Globe,
  },
];

export default function AtProtocol() {
  return (
    <section id="atproto" className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex justify-center mb-4 opacity-60">
        <svg
          fill="currentColor"
          viewBox={BLUESKY_VIEWBOX}
          width={40}
          height={36}
          aria-hidden="true"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path d={BLUESKY_PATH} fillRule="evenodd" clipRule="evenodd" />
        </svg>
      </div>
      <p className="text-center text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
        Federation &middot; Live today
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
        AT&nbsp;Protocol, first-class
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] text-sm sm:text-base max-w-2xl mx-auto mb-12 leading-relaxed pretty">
        Every <code className="text-xs">exchange.recipe</code> record is available to browse and import as a recipe in Pantry&nbsp;Host. Paste an <code className="text-xs">at://</code> URL, scan a QR, or browse the live feed. The source record stays on its author&rsquo;s PDS, and imports go straight to your own hardware. Pantry&nbsp;Host infrastructure never stores&nbsp;either.
      </p>

      {/* 3-up — What's live today */}
      <div className="grid md:grid-cols-3 gap-6 mb-10">
        {liveTiles.map((tile) => {
          const inner = (
            <>
              <div className="mb-3 opacity-60">
                <tile.icon size={24} weight="light" />
              </div>
              <h3 className="text-xl font-bold mb-2">{tile.title}</h3>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pretty">
                {tile.description}
              </p>
            </>
          );
          const classes =
            'rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5 block transition-colors';
          if (tile.href) {
            return (
              <a
                key={tile.title}
                href={tile.href}
                target="_blank"
                rel="noopener noreferrer"
                className={`${classes} hover:border-[var(--color-accent)]`}
              >
                {inner}
              </a>
            );
          }
          return (
            <div key={tile.title} className={classes}>
              {inner}
            </div>
          );
        })}
      </div>

      {/* Principles — secondary callout */}
      <div className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-6 sm:p-8">
        <h3 className="text-xl sm:text-2xl font-bold mb-6 text-center">
          Built on open infrastructure
        </h3>
        <div className="grid md:grid-cols-3 gap-6">
          {principles.map((p) => (
            <div key={p.title}>
              <div className="mb-3 opacity-60">
                <p.icon size={24} weight="light" />
              </div>
              <h4 className="text-lg font-bold mb-2">{p.title}</h4>
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pretty">
                {p.description}
              </p>
            </div>
          ))}
        </div>
      </div>

      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8 max-w-2xl mx-auto pretty">
        Coming next: one-tap publish to your own PDS from within Pantry&nbsp;Host. Expected in <time dateTime="2026">v0.5</time>.
      </p>
    </section>
  );
}
