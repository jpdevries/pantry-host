function IconBrowser() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={32} height={32} fill="currentColor" aria-hidden="true">
      <path d="M464 32H48C21.5 32 0 53.5 0 80v352c0 26.5 21.5 48 48 48h416c26.5 0 48-21.5 48-48V80c0-26.5-21.5-48-48-48zM32 80c0-8.8 7.2-16 16-16h48v64H32V80zm448 352c0 8.8-7.2 16-16 16H48c-8.8 0-16-7.2-16-16V160h448v272zm0-304H128V64h336c8.8 0 16 7.2 16 16v48z" />
    </svg>
  );
}

function IconServer() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={32} height={32} fill="currentColor" aria-hidden="true">
      <path d="M376 256c0-13.255 10.745-24 24-24s24 10.745 24 24-10.745 24-24 24-24-10.745-24-24zm-40 24c13.255 0 24-10.745 24-24s-10.745-24-24-24-24 10.745-24 24 10.745 24 24 24zm176-128c0 12.296-4.629 23.507-12.232 32 7.603 8.493 12.232 19.704 12.232 32v80c0 12.296-4.629 23.507-12.232 32 7.603 8.493 12.232 19.704 12.232 32v80c0 26.51-21.49 48-48 48H48c-26.51 0-48-21.49-48-48v-80c0-12.296 4.629-23.507 12.232-32C4.629 319.507 0 308.296 0 296v-80c0-12.296 4.629-23.507 12.232-32C4.629 175.507 0 164.296 0 152V72c0-26.51 21.49-48 48-48h416c26.51 0 48 21.49 48 48v80zm-480 0c0 8.822 7.178 16 16 16h416c8.822 0 16-7.178 16-16V72c0-8.822-7.178-16-16-16H48c-8.822 0-16 7.178-16 16v80zm432 48H48c-8.822 0-16 7.178-16 16v80c0 8.822 7.178 16 16 16h416c8.822 0 16-7.178 16-16v-80c0-8.822-7.178-16-16-16zm16 160c0-8.822-7.178-16-16-16H48c-8.822 0-16 7.178-16 16v80c0 8.822 7.178 16 16 16h416c8.822 0 16-7.178 16-16v-80zm-80-224c13.255 0 24-10.745 24-24s-10.745-24-24-24-24 10.745-24 24 10.745 24 24 24zm-64 0c13.255 0 24-10.745 24-24s-10.745-24-24-24-24 10.745-24 24 10.745 24 24 24zm64 240c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24zm-64 0c-13.255 0-24 10.745-24 24s10.745 24 24 24 24-10.745 24-24-10.745-24-24-24z" />
    </svg>
  );
}

function IconTerminal() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512" width={32} height={32} fill="currentColor" aria-hidden="true">
      <path d="M34.495 36.465l211.051 211.05c4.686 4.686 4.686 12.284 0 16.971L34.495 475.535c-4.686 4.686-12.284 4.686-16.97 0l-7.071-7.07c-4.686-4.686-4.686-12.284 0-16.971L205.947 256 10.454 60.506c-4.686-4.686-4.686-12.284 0-16.971l7.071-7.07c4.686-4.687 12.284-4.687 16.97 0zM640 468v-10c0-6.627-5.373-12-12-12H300c-6.627 0-12 5.373-12 12v10c0 6.627 5.373 12 12 12h328c6.627 0 12-5.373 12-12z" />
    </svg>
  );
}

const tiers = [
  {
    name: 'Just Use It',
    audience: 'Browser',
    description:
      'Run Pantry Host entirely in your browser. No server, no install. Your data lives in your browser via PGlite and OPFS.',
    features: ['Works offline', 'Zero setup', 'Export your data anytime', 'Supercharged with Claude in Chrome'],
    cta: { label: 'Open in browser', href: 'https://my.pantryhost.app' },
    icon: IconBrowser,
    eta: { display: 'Ready instantly', iso: 'PT0S' },
  },
  {
    name: 'Host It',
    audience: 'Self-hosted',
    description:
      'Run on your own machine with PostgreSQL. Full control, full privacy. Perfect for a home Mac Mini or Raspberry Pi.',
    features: ['PostgreSQL database', 'Multi-device on your LAN', 'Photo uploads', 'AI recipe generation*'],
    footnote: '*With your own API key',
    cta: { label: 'View setup guide', href: 'https://github.com/jpdevries/pantry-host?tab=readme-ov-file#local-hosting', target: '_ph_self-hosted' },
    icon: IconServer,
    eta: { display: '~15 min setup', iso: 'PT15M' },
  },
  {
    name: 'Power User',
    audience: 'Claude Code',
    description:
      'Use Claude Code to self-host or Claude in Chrome to supercharge the browser version. Import recipes from any URL, generate new ones, manage your pantry conversationally.',
    features: ['AI recipe generation', 'URL recipe import', 'Conversational pantry management'],
    cta: { label: 'Learn more', href: 'https://github.com/jpdevries/pantry-host?tab=readme-ov-file#power-user', target: '_ph_power-user' },
    icon: IconTerminal,
    eta: { display: '~5 min setup', iso: 'PT5M' },
  },
];

export default function Tiers() {
  return (
    <section id="tiers" className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <h2
        className="text-3xl sm:text-4xl font-bold text-center mb-12"
        style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
      >
        Three ways to&nbsp;run&nbsp;it
      </h2>
      <div className="grid md:grid-cols-3 gap-6">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="tier-card rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-6 flex flex-col"
          >
            <div className="mb-3 opacity-60">
              <tier.icon />
            </div>
            <p className="text-xs font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-1">
              {tier.audience}
            </p>
            <h3
              className="text-3xl font-bold"
              style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
            >
              {tier.name}
            </h3>
            <time dateTime={tier.eta.iso} className="block text-xs text-[var(--color-text-secondary)] italic mb-3">{tier.eta.display}</time>
            <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
              {tier.description}
            </p>
            <ul className="text-sm space-y-2 mb-6 flex-1">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <span className="mt-0.5" aria-hidden="true">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>
            {'footnote' in tier && tier.footnote && (
              <p className="text-xs text-[var(--color-text-secondary)] italic mb-4">{tier.footnote}</p>
            )}
            <a
              href={tier.cta.href}
              {...(tier.cta.target ? { target: tier.cta.target } : {})}
              className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg text-sm font-semibold border border-[var(--color-border-card)] text-[var(--color-text-primary)] hover:underline transition-colors"
            >
              {tier.cta.label}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
