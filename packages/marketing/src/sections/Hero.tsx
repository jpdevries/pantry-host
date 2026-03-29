import { CaretDown } from '@phosphor-icons/react';

function IconGitHub({ size = 18 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 496 512" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8zM97.2 352.9c-1.3 1-1 3.3.7 5.2 1.6 1.6 3.9 2.3 5.2 1 1.3-1 1-3.3-.7-5.2-1.6-1.6-3.9-2.3-5.2-1zm-10.8-8.1c-.7 1.3.3 2.9 2.3 3.9 1.6 1 3.6.7 4.3-.7.7-1.3-.3-2.9-2.3-3.9-2-.6-3.6-.3-4.3.7zm32.4 35.6c-1.6 1.3-1 4.3 1.3 6.2 2.3 2.3 5.2 2.6 6.5 1 1.3-1.3.7-4.3-1.3-6.2-2.2-2.3-5.2-2.6-6.5-1zm-11.4-14.7c-1.6 1-1.6 3.6 0 5.9 1.6 2.3 4.3 3.3 5.6 2.3 1.6-1.3 1.6-3.9 0-6.2-1.4-2.3-4-3.3-5.6-2z" />
    </svg>
  );
}


export default function Hero() {
  return (
    <section className="px-4 sm:px-6 flex flex-col items-center justify-center text-center max-w-4xl mx-auto">
      <div className="flex-1" />
      <div>
        <h1
          className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight leading-tight"
        >
          There&rsquo;s already enough of your data in&nbsp;the&nbsp;cloud.
        </h1>
        <p className="pretty mt-6 text-xl sm:text-2xl text-[var(--color-text-secondary)] max-w-2xl mx-auto leading-relaxed font-serif">
          Pantry&nbsp;Host is a self-hosted, privacy-first kitchen companion for managing recipes, ingredients, cookware, and grocery lists.<br /><em className="not-italic font-semibold text-[var(--color-text-primary)]">All on your&nbsp;own&nbsp;hardware</em>.
        </p>
      </div>
      <div className="flex-1" />
      <div className="mt-8 pb-12 sm:pb-16 flex flex-col sm:flex-row gap-4 justify-center w-full">
        <a
          href="#getting-started"
          onClick={(e) => {
            e.preventDefault();
            document.getElementById('getting-started')?.scrollIntoView({ behavior: 'smooth' });
          }}
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-base bg-[var(--color-accent)] text-[var(--color-bg-body)] hover:underline transition-colors"
        >
          Get started
          <CaretDown size={14} weight="bold" />
        </a>
        <a
          href="https://github.com/jpdevries/pantry-host"
          className="inline-flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-semibold text-base border border-[var(--color-border-card)] text-[var(--color-text-primary)] hover:underline transition-colors"
        >
          <IconGitHub />
          View on GitHub
        </a>
      </div>
    </section>
  );
}
