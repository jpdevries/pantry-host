import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';

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

  const [currentPath, setCurrentPath] = useState('');
  useEffect(() => { setCurrentPath(router.pathname); }, [router.pathname]);
  useEffect(() => {
    const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    setIsSecure(isDev || window.location.protocol === 'https:');
  }, []);

  return (
    <header className="relative flex flex-col min-h-[100svh] md:min-h-0 bg-zinc-950 text-zinc-50 px-6 py-8">
      {/* Site identity */}
      <div className="flex items-center justify-between">
        {currentPath === '/' || currentPath === '' ? (
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pear.png" alt="" aria-hidden="true" width={42} height={42} className="w-[42px] h-[42px] object-contain rounded-sm" />
            <span className="text-2xl font-bold tracking-tight">Pantry List</span>
          </div>
        ) : (
          <a
            href="/#stage"
            className="flex items-center gap-3 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
            aria-label="Pantry List — home"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/pear.png" alt="" aria-hidden="true" width={42} height={42} className="w-[42px] h-[42px] object-contain rounded-sm" />
            <span className="text-2xl font-bold tracking-tight">Pantry List</span>
          </a>
        )}

        {/* Desktop nav */}
        <nav
          aria-label="Main navigation"
          className="hidden md:block absolute right-6 top-1/2 -translate-y-1/2"
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
                      'text-sm font-semibold tracking-wide uppercase transition-colors',
                      active ? 'text-amber-400' : 'text-zinc-300 hover:text-zinc-50',
                    ].join(' ')}
                  >
                    {label}
                  </a>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>

      {/* Mobile nav */}
      <nav aria-label="Main navigation" className="mt-auto pb-16 md:hidden">
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
                    'block text-3xl font-bold tracking-tight transition-colors',
                    active ? 'text-amber-400' : 'text-zinc-300 hover:text-zinc-50',
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
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-zinc-500 hover:text-zinc-300 transition-colors md:hidden"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </a>
    </header>
  );
}
