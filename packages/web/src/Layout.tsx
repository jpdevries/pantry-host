import { Outlet, NavLink, useLocation } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import Footer from '@pantry-host/shared/components/Footer';
import { getDailyQuote } from '@pantry-host/shared/dailyQuote';

const NAV_ITEMS = [
  { to: '/ingredients', label: 'Pantry' },
  { to: '/list', label: 'Grocery List' },
  { to: '/menus', label: 'Menus' },
  { to: '/recipes', label: 'Recipes' },
  { to: '/cookware', label: 'Cookware' },
];

export default function Layout() {
  const location = useLocation();
  const chevronRef = useRef<HTMLAnchorElement>(null);
  const [quote, setQuote] = useState<{ text: string; author: string } | null>(null);

  useEffect(() => { setQuote(getDailyQuote()); }, []);

  function scrollToStage(e: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById('stage');
    if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
  }

  function handleNavClick(e: React.MouseEvent<HTMLAnchorElement>, to: string) {
    if (location.pathname === to) {
      const target = document.getElementById('stage');
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    }
  }

  const isHome = location.pathname === '/';

  return (
    <div className="min-h-screen bg-[var(--color-bg-body)] text-[var(--color-text-primary)] transition-colors">
      <header
        className="relative flex flex-col min-h-[100svh] sm:min-h-0 px-6 py-8"
        style={{ backgroundColor: 'var(--color-bg-nav)', color: 'var(--color-text-primary)' }}
      >
        {/* Site identity */}
        <div className="flex items-center justify-between">
          {isHome ? (
            <span
              className="text-2xl font-bold tracking-tight"
              style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
            >
              Pantry Host
            </span>
          ) : (
            <NavLink
              to="/"
              onClick={(e) => handleNavClick(e, '/')}
              className="text-2xl font-bold tracking-tight hover:underline focus-visible:outline-2 focus-visible:outline-offset-2"
              style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
              aria-label="Pantry Host — home"
            >
              Pantry Host
            </NavLink>
          )}

          {/* Desktop nav */}
          <nav
            aria-label="Main navigation"
            className="hidden sm:block absolute right-6 top-1/2 -translate-y-1/2"
          >
            <ul className="flex gap-8" role="list">
              {NAV_ITEMS.map(({ to, label }) => {
                const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
                return (
                  <li key={label}>
                    <NavLink
                      to={to}
                      onClick={(e) => handleNavClick(e, to)}
                      aria-current={active ? 'page' : undefined}
                      className={[
                        'text-base font-semibold tracking-wide uppercase transition-colors',
                        active ? 'text-accent' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                      ].join(' ')}
                      style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
                    >
                      {label}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </nav>
        </div>

        {/* Random quote (mobile only — fills dead space in 100svh cover) */}
        {quote && (
          <blockquote className="my-auto px-2 sm:hidden text-[var(--color-text-secondary)] text-lg italic max-w-[36ch] pretty" style={{ opacity: 0.7, fontFamily: "'Crimson Pro', Georgia, serif" }}>
            <p>&ldquo;{quote.text}&rdquo;</p>
            <footer className="mt-2 text-sm not-italic text-[var(--color-text-secondary)]" style={{ fontFamily: 'system-ui, sans-serif' }}>— {quote.author}</footer>
          </blockquote>
        )}

        {/* Mobile nav */}
        <nav aria-label="Main navigation" className="mt-auto pb-16 sm:hidden">
          <ul className="space-y-8" role="list">
            {NAV_ITEMS.map(({ to, label }) => {
              const active = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
              return (
                <li key={label}>
                  <NavLink
                    to={to}
                    onClick={(e) => handleNavClick(e, to)}
                    aria-current={active ? 'page' : undefined}
                    className={[
                      'block text-3xl font-bold tracking-tight transition-colors',
                      active ? 'text-accent' : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]',
                    ].join(' ')}
                    style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
                  >
                    {label}
                  </NavLink>
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

      <main id="stage" className="max-w-5xl mx-auto px-4 sm:px-6 py-8 scroll-mt-20">
        <Outlet />
      </main>
      <Footer />
    </div>
  );
}
