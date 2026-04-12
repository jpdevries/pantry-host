import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { getDailyQuote } from '@pantry-host/shared/dailyQuote';
import { isTrustedNetwork } from '@/lib/isTrustedNetwork';

function PantryHostLogo({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M992,272.99s-212.22-214.32-230.52-214.32H583.6" />
      <path d="M441.31,58.67h-178.8C244.22,58.67,32,272.99,32,272.99" />
      <path d="M396.03,97.86c36.36-32.28,57.58-48.55,63.33-48.59l104.97-.62c5.74-.03,27.16,15.99,63.67,47.63" />
      <path d="M627.97,96.16l.03,11.97-231.94,1.54-.03-11.97" />
      <path d="M973.55,412.1c-11.8,93.7-24.9,200.14-37.03,296.08-11.32,104.93-23.12,197.98-130.19,246.67-48.18,20.2-98.78,20.89-150.6,20.42-48.27.06-98.27.08-146.88.07-60.21,0-123.13.01-182.68-.16-93.33,1.32-183.46-35.54-216.97-128.82-19.15-48.2-19.4-99.7-26.55-151.08-9.78-84.77-20.27-178.07-29.75-260.98-2.2-22.05-4.56-25.11-1.3-41.7,4.12-17.06,18.47-30.64,36.39-30.42,282.84,0,565.67,0,848.51,0C962.05,361.91,977.33,388.32,973.55,412.1z" />
      <path d="M980.98,361.46H43.02c-8.81,0-16.02-7.21-16.02-16.02v-59.9c0-8.81,7.21-16.02,16.02-16.02h937.95c8.81,0,16.02,7.21,16.02,16.02v59.9c0,8.81-7.21,16.02-16.02,16.02z" />
      <path fill="currentColor" stroke="none" d="M512.07,621.83c29.52,0,53.54,24.02,53.54,53.54s-24.02,53.54-53.54,53.54-53.54-24.02-53.54-53.54,24.02-53.54,53.54-53.54m0-21c-41.17,0-74.54,33.37-74.54,74.54,0,41.17,33.37,74.54,74.54,74.54,41.17,0,74.54-33.37,74.54-74.54,0-41.17-33.37-74.54-74.54-74.54z" />
      <path fill="currentColor" stroke="none" d="M512.07,673.87c-6.17,0-11.16,5-11.16,11.16s5,11.16,11.16,11.16,11.16-5,11.16-11.16-5-11.16-11.16-11.16z" />
      <path d="M819.02,466.59H209.8c-19.93,0-34.54,13.98-32.48,31.08l39.25,324.44c2.07,17.09,17.75,31.08,34.84,31.08h522.54c17.09,0,32.9-13.98,35.12-31.08l42.15-324.44c2.21-17.09-12.27-31.08-32.2-31.08z" />
      <path d="M752.66,527.76H275.61c-14.35,0-25.12,10.3-23.92,22.9l20.79,218.45c1.2,12.59,12.75,22.9,25.68,22.9h429.58c12.93,0,24.57-10.3,25.89-22.9l22.74-218.45c1.31-12.59-9.36-22.9-23.71-22.9z" />
      <path d="M727.72,792.25c-2.74,30.26,16.93,55.89,46.05,60.7" />
      <path d="M177.69,498.48c5.23,12.83,15.03,24.44,27.75,32.87,13.45,8.96,29.67,13.89,45.73,13.89.15,0,.3,0,.45-.01" />
    </svg>
  );
}

export default function Nav() {
  const router = useRouter();
  const chevronRef = useRef<HTMLAnchorElement>(null);

  const [kitchenSlug, setKitchenSlug] = useState('home');
  const [isKitchenRoute, setIsKitchenRoute] = useState(false);
  const [isSecure, setIsSecure] = useState(true);

  useEffect(() => {
    const match = router.asPath.match(/^\/kitchens\/([^/?#]+)/);
    setIsKitchenRoute(!!match);
    setKitchenSlug(match?.[1] ?? 'home');
  }, [router.asPath]);

  function kitchenHref(path: string): string {
    return isKitchenRoute ? `/kitchens/${kitchenSlug}${path}` : path;
  }

  const links = [
    { href: kitchenHref('/ingredients'), label: 'Pantry' },
    { href: kitchenHref('/list'),        label: 'List' },
    { href: kitchenHref('/menus'),       label: 'Menus' },
    { href: kitchenHref('/recipes'),     label: 'Recipes' },
    ...(isSecure ? [{ href: kitchenHref('/cookware'), label: 'Cookware' }] : []),
  ];

  function scrollToStage(e: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById('stage');
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  }

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, href: string) {
    if (router.pathname === href.split('#')[0]) {
      const target = document.getElementById('stage');
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    }
  }

  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);
  useEffect(() => { setQuote(getDailyQuote()); }, []);

  const [currentPath, setCurrentPath] = useState('');
  useEffect(() => { setCurrentPath(router.pathname); }, [router.pathname]);
  useEffect(() => {
    setIsSecure(isTrustedNetwork(window.location.hostname) || window.location.protocol === 'https:');
  }, []);

  return (
    <header className="relative flex flex-col min-h-[100svh] sm:min-h-0 px-6 py-8" style={{ backgroundColor: 'var(--color-bg-nav)', color: 'var(--color-text-primary)' }}>
      {/* Site identity */}
      <div className="flex items-center justify-between">
        {currentPath === '/' || currentPath === '' ? (
          <span className="text-2xl font-bold tracking-tight font-serif inline-flex items-center gap-2"><PantryHostLogo size={24} /> Pantry Host</span>
        ) : (
          <a
            href="/#stage"
            className="text-2xl font-bold tracking-tight font-serif hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent inline-flex items-center gap-2"
            aria-label="Pantry Host — home"
          >
            <PantryHostLogo size={24} /> Pantry Host
          </a>
        )}

      </div>

      {/* Desktop/phablet nav — stacks below branding at sm, inline at lg */}
      <nav
        aria-label="Main navigation"
        className="hidden sm:block mt-3 lg:mt-0 lg:absolute lg:right-6 lg:top-1/2 lg:-translate-y-1/2"
      >
        <ul className="flex flex-wrap gap-x-8 gap-y-2 sm:justify-end lg:justify-start" role="list">
          {links.map(({ href, label }) => {
            const active = currentPath === href || (href !== '/' && currentPath.startsWith(href.split('#')[0]));
            return (
              <li key={label}>
                <a
                  href={`${href}#stage`}
                  onClick={(e) => handleNavClick(e, href)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'text-base font-semibold tracking-wide uppercase transition-colors font-serif',
                    active ? 'text-accent' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                  ].join(' ')}
                >
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Random quote (mobile only — fills dead space in 100svh cover) */}
      {quote && (
        <blockquote className="my-auto px-2 sm:hidden text-[var(--color-text-secondary)] text-lg italic max-w-[36ch] font-serif pretty" style={{ opacity: 0.7 }}>
          <p>&ldquo;{quote.text}&rdquo;</p>
          <footer className="mt-2 text-sm not-italic text-[var(--color-text-secondary)] font-sans">— {quote.author}</footer>
        </blockquote>
      )}

      {/* Mobile nav */}
      <nav aria-label="Main navigation" className="mt-auto pb-16 sm:hidden">
        <ul className="space-y-8" role="list">
          {links.map(({ href, label }) => {
            const active = currentPath === href || (href !== '/' && currentPath.startsWith(href.split('#')[0]));
            return (
              <li key={label}>
                <a
                  href={`${href}#stage`}
                  onClick={(e) => handleNavClick(e, href)}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'block text-3xl font-bold tracking-tight transition-colors font-serif',
                    active ? 'text-accent' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                  ].join(' ')}
                >
                  {label}
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Scroll indicator (mobile only) */}
      <a
        ref={chevronRef}
        href="#stage"
        onClick={scrollToStage}
        aria-label="Scroll to content"
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors sm:hidden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </a>
    </header>
  );
}
