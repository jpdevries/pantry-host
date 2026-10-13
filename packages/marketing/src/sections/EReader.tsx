import { BookOpenText } from '@phosphor-icons/react';

const cards = [
  {
    title: 'The whole app, not just a reader',
    description:
      'E‑reader browsers lag years behind, so Pantry Host ships a copy of the app they can run: search and filter recipes, queue them for the grocery list, check off items, and import from Bluesky. Current browsers never download it.',
  },
  {
    title: 'Styled for the screen',
    description:
      'A lightweight stylesheet loads only in browsers that can’t handle the full design. Modern browsers skip it, and when your e‑reader’s browser catches up, it gets the full design automatically.',
  },
  {
    title: 'Dark mode, per device',
    description:
      'E‑reader browsers don’t tell websites when you switch to dark mode, so pick Light or Dark from the page footer. The choice is saved on that device only.',
  },
];

export default function EReader() {
  return (
    <section id="e-reader" className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex justify-center mb-4 opacity-60">
        <BookOpenText size={32} weight="light" />
      </div>
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
        Cook from your e&#8209;reader
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] text-sm sm:text-base max-w-2xl mx-auto mb-10 leading-relaxed">
        Prop a Kindle on the counter and cook from your self&#8209;hosted Pantry&nbsp;Host.
        Recipes, menus, your pantry, and the
        grocery&nbsp;list are all there, styled for the screen, and the controls work too, right
        down to checking off ingredients as you&nbsp;go.
      </p>
      <div className="grid sm:grid-cols-3 gap-6">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5"
          >
            <h3 className="text-lg font-bold mb-2">{c.title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {c.description}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5">
        <h3 className="text-lg font-bold mb-2">Take your cookbook off Wi&#8209;Fi</h3>
        <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
          Away from home, an e&#8209;reader can&rsquo;t reach your server. Ask Claude&nbsp;Code to
          publish a kitchen and it builds an EPUB cookbook with photos, menus by course, and
          recipes A&ndash;Z, then drops it in the Google&nbsp;Drive folder your Kindle imports
          from. The e&#8209;reader just reads a file, so your recipes go wherever it&nbsp;does.{' '}
          <a
            href="https://github.com/jpdevries/pantry-host?tab=readme-ov-file#kitchens-as-ebooks"
            target="_ph_power-user"
            className="underline hover:text-[var(--color-accent)]"
          >
            How it&nbsp;works
          </a>
        </p>
      </div>
      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-6">
        The app on your e&#8209;reader is part of the Host&nbsp;It tier, tested on the Kindle
        Scribe Colorsoft with both the Docker&nbsp;install and the Rust server the
        Pi&nbsp;Zero&nbsp;W image&nbsp;runs. EPUB cookbooks are part of the Power&nbsp;User&nbsp;tier.
      </p>
    </section>
  );
}
