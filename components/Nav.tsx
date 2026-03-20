import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { getDailyQuote } from '@/lib/dailyQuote';

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
    { href: kitchenHref('/list'),        label: 'Grocery List' },
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
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    setIsSecure(isDev || window.location.protocol === 'https:');
  }, []);

  return (
    <header className="relative flex flex-col min-h-[100svh] sm:min-h-0 px-6 py-8" style={{ backgroundColor: 'var(--color-bg-nav)', color: 'var(--color-text-primary)' }}>
      {/* Site identity */}
      <div className="flex items-center justify-between">
        {currentPath === '/' || currentPath === '' ? (
          <span className="text-2xl font-bold tracking-tight font-serif" style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}>Pantry Host</span>
        ) : (
          <a
            href="/#stage"
            className="text-2xl font-bold tracking-tight font-serif hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
            aria-label="Pantry Host — home"
          >
            Pantry Host
          </a>
        )}

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          className="hidden sm:block absolute right-6 top-1/2 -translate-y-1/2"
        >
          <ul className="flex gap-8" role="list">
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
                      active ? 'text-accent' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50',
                    ].join(' ')}
                    style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Random quote (mobile only — fills dead space in 100svh cover) */}
      {quote && (
        <blockquote className="my-auto px-2 sm:hidden text-zinc-400 dark:text-zinc-500 text-lg italic max-w-[36ch] font-serif pretty">
          <p>&ldquo;{quote.text}&rdquo;</p>
          <footer className="mt-2 text-sm not-italic text-zinc-500 dark:text-zinc-600 font-sans">— {quote.author}</footer>
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
                    active ? 'text-accent' : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-300 dark:hover:text-zinc-50',
                  ].join(' ')}
                  style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
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
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-zinc-400 hover:text-zinc-600 dark:text-zinc-500 dark:hover:text-zinc-300 transition-colors sm:hidden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </a>
    </header>
  );
}
