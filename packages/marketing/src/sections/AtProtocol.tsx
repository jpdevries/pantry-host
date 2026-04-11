import { Share, IdentificationCard, Globe } from '@phosphor-icons/react';

/**
 * AT Protocol / Bluesky teaser section.
 *
 * This is a marketing-first announcement: the integration itself is
 * scheduled as a weekend hackathon project (with Austin), and the
 * implementation lives on the `feature/atproto` branch. This section
 * tells the story so the announcement and the build can ship in
 * either order.
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
      <>We adopt the existing <code>exchange.recipe.recipe</code> and <code>exchange.recipe.collection</code> lexicons from <code>recipe.exchange</code>. Share individual recipes or entire menus&nbsp;&mdash; visible on every compatible&nbsp;client.</>,
    icon: Share,
  },
  {
    title: 'Federated',
    description:
      <>No <code>pantryhost.app/recipe/123</code> URL — by design. Recipes are addressable by AT URI and travel with your identity, not ours.</>,
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
        Coming soon
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
        Share to&nbsp;Bluesky
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] text-sm sm:text-base max-w-2xl mx-auto mb-12 leading-relaxed pretty">
        Pantry&nbsp;Host is getting native <abbr title="The protocol behind Bluesky">AT&nbsp;Protocol</abbr> support so you can publish a recipe to your own Bluesky identity in one&nbsp;tap&nbsp;&mdash; without us hosting&nbsp;anything.
      </p>

      <div className="grid md:grid-cols-3 gap-6 mb-6">
        {principles.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5"
          >
            <div className="mb-3 opacity-60">
              <p.icon size={24} weight="light" />
            </div>
            <h3 className="text-xl font-bold mb-2">{p.title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pretty">
              {p.description}
            </p>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-6 sm:p-8">
        <h3 className="text-xl sm:text-2xl font-bold mb-3 text-center">
          How it&rsquo;ll work
        </h3>
        <ol className="grid sm:grid-cols-2 gap-x-8 gap-y-3 text-sm text-[var(--color-text-secondary)] leading-relaxed max-w-3xl mx-auto list-decimal pl-5 marker:text-[var(--color-accent)] marker:font-semibold">
          <li>
            Hit <em>Share to Bluesky</em> on any recipe or menu and sign in with Bluesky.
          </li>
          <li>
            Pantry&nbsp;Host maps your data to the <code className="text-xs">exchange.recipe.recipe</code> or <code className="text-xs">collection</code> lexicon.
          </li>
          <li>
            The record gets published to your own <abbr title="Personal Data Server">PDS</abbr> &mdash; Pantry&nbsp;Host never touches&nbsp;it.
          </li>
          <li>
            Anyone with the AT&nbsp;URI can import it back into their own pantry, or browse it on{' '}
            <a
              href="https://recipe.exchange/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-[var(--color-accent)]"
            >
              recipe.exchange
            </a>
            .
          </li>
        </ol>
      </div>

      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-6 max-w-2xl mx-auto pretty">
        AT&nbsp;Protocol integration enables you to share just the recipes you choose to, on your own Personal Data&nbsp;Server, in an open&nbsp;format.
      </p>
    </section>
  );
}
