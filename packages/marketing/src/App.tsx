import Hero from './sections/Hero';
import Tiers from './sections/Tiers';
import Features from './sections/Features';
import Philosophy from './sections/Philosophy';
import Footer from '@pantry-host/shared/components/Footer';

function LogoPlaceholder() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width={24} height={24} fill="currentColor" aria-hidden="true">
      <path d="M442.7 32c-95.9 0-176.4 79.4-197.2 185.7C210.5 145.1 144.8 96 69.3 96H0v16c0 132.3 90.9 240 202.7 240H240v120c0 4.4 3.6 8 8 8h16c4.4 0 8-3.6 8-8V288h37.3C421.1 288 512 180.3 512 48V32h-69.3zm-240 288C113 320 39.2 235.2 32.5 128h36.8c89.7 0 163.4 84.8 170.2 192h-36.8zm106.6-64h-36.8C279.2 148.8 353 64 442.7 64h36.8c-6.7 107.2-80.5 192-170.2 192z" />
    </svg>
  );
}

export default function App() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-body)] text-[var(--color-text-primary)] transition-colors">
      <header className="px-4 sm:px-6 py-4 max-w-5xl mx-auto">
        <a href="/" className="inline-flex items-center gap-2 text-[var(--color-accent)] hover:underline">
          <LogoPlaceholder />
          <span
            className="text-xl font-bold text-[var(--color-text-primary)]"
            style={{ fontFamily: "'Crimson Pro', Georgia, serif" }}
          >
            Pantry Host
          </span>
        </a>
      </header>
      <Hero />
      <Tiers />
      <Features />
      <Philosophy />
      <Footer />
    </div>
  );
}
