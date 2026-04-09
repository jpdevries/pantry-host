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

// Bluesky official butterfly mark — single-path SVG, monochrome via currentColor.
const BLUESKY_PATH =
  'M5.534 3.787C8.443 5.97 11.572 10.395 12.72 12.769c1.148-2.374 4.277-6.799 7.186-8.982C22.005 2.213 25.5.642 25.5 4.628c0 .795-.456 6.683-.724 7.638-.93 3.323-4.317 4.17-7.328 3.658 5.265.896 6.604 3.866 3.711 6.836-5.494 5.642-7.896-1.416-8.512-3.225a14.42 14.42 0 0 1-.327-1.158 14.42 14.42 0 0 1-.327 1.158c-.616 1.81-3.018 8.867-8.512 3.225-2.893-2.97-1.554-5.94 3.711-6.836-3.011.512-6.397-.335-7.328-3.658C-1.404 11.31-1.86 5.422-1.86 4.628-1.86.642 1.635 2.213 3.765 3.787L5.534 3.787z';

const principles = [
  {
    title: 'Your records, your PDS',
    description:
      'Recipes you choose to share live on your own Personal Data Server — Bluesky-hosted by default, self-hostable if you want. Same philosophy as the rest of Pantry\u00a0Host.',
    icon: IdentificationCard,
  },
  {
    title: 'One open lexicon',
    description:
      'We adopt the existing exchange.recipe.recipe lexicon from recipe.exchange instead of inventing a new one. Your shared recipes show up on every compatible client.',
    icon: Share,
  },
  {
    title: 'Federated, not centralized',
    description:
      'No pantryhost.app/recipe/123 URL — by design. Recipes are addressable by AT URI and travel with your identity, not ours.',
    icon: Globe,
  },
];

export default function AtProtocol() {
  return (
    <section id="atproto" className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex justify-center mb-4 opacity-60">
        <svg
          fill="currentColor"
          viewBox="0 0 24 24"
          width={36}
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

      <div className="grid md:grid-cols-3 gap-6 mb-10">
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
            Hit <em>Share to Bluesky</em> on any recipe and authenticate with your handle.
          </li>
          <li>
            Pantry&nbsp;Host maps your structured recipe to the <code className="text-xs">exchange.recipe.recipe</code> lexicon.
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
        Built on the same decentralized index pattern as the Cooklang&nbsp;Federation. Adopting an existing lexicon over inventing a new one&nbsp;&mdash; ecosystem citizenship over <abbr title="Not Invented Here">NIH</abbr>.
      </p>
    </section>
  );
}
