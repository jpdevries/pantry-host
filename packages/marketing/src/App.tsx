import { Routes, Route } from 'react-router-dom';
import Hero from './sections/Hero';
import Tiers from './sections/Tiers';
import Features from './sections/Features';
import Integrations from './sections/Integrations';
import DemoVideos from './sections/DemoVideos';
import { Docker, RaspberryPi } from './sections/SelfHost';
import Philosophy from './sections/Philosophy';
import Footer from '@pantry-host/shared/components/Footer';
import AccessibilityPreferences from '@pantry-host/shared/components/AccessibilityPreferences';
function PantryHostLogo({ size = 24 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={46} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {/* Lid handle + hinges */}
      <path d="M992,272.99s-212.22-214.32-230.52-214.32H583.6" />
      <path d="M441.31,58.67h-178.8C244.22,58.67,32,272.99,32,272.99" />
      <path d="M396.03,97.86c36.36-32.28,57.58-48.55,63.33-48.59l104.97-.62c5.74-.03,27.16,15.99,63.67,47.63" />
      <path d="M627.97,96.16l.03,11.97-231.94,1.54-.03-11.97" />
      {/* Body */}
      <path d="M973.55,412.1c-11.8,93.7-24.9,200.14-37.03,296.08-11.32,104.93-23.12,197.98-130.19,246.67-48.18,20.2-98.78,20.89-150.6,20.42-48.27.06-98.27.08-146.88.07-60.21,0-123.13.01-182.68-.16-93.33,1.32-183.46-35.54-216.97-128.82-19.15-48.2-19.4-99.7-26.55-151.08-9.78-84.77-20.27-178.07-29.75-260.98-2.2-22.05-4.56-25.11-1.3-41.7,4.12-17.06,18.47-30.64,36.39-30.42,282.84,0,565.67,0,848.51,0C962.05,361.91,977.33,388.32,973.55,412.1z" />
      {/* Rim */}
      <path d="M980.98,361.46H43.02c-8.81,0-16.02-7.21-16.02-16.02v-59.9c0-8.81,7.21-16.02,16.02-16.02h937.95c8.81,0,16.02,7.21,16.02,16.02v59.9c0,8.81-7.21,16.02-16.02,16.02z" />
      {/* Keyhole ring */}
      <path fill="currentColor" stroke="none" d="M512.07,621.83c29.52,0,53.54,24.02,53.54,53.54s-24.02,53.54-53.54,53.54-53.54-24.02-53.54-53.54,24.02-53.54,53.54-53.54m0-21c-41.17,0-74.54,33.37-74.54,74.54,0,41.17,33.37,74.54,74.54,74.54,41.17,0,74.54-33.37,74.54-74.54,0-41.17-33.37-74.54-74.54-74.54z" />
      {/* Keyhole */}
      <path fill="currentColor" stroke="none" d="M512.07,673.87c-6.17,0-11.16,5-11.16,11.16s5,11.16,11.16,11.16,11.16-5,11.16-11.16-5-11.16-11.16-11.16z" />
      {/* Inner panel outer */}
      <path d="M819.02,466.59H209.8c-19.93,0-34.54,13.98-32.48,31.08l39.25,324.44c2.07,17.09,17.75,31.08,34.84,31.08h522.54c17.09,0,32.9-13.98,35.12-31.08l42.15-324.44c2.21-17.09-12.27-31.08-32.2-31.08z" />
      {/* Inner panel */}
      <path d="M752.66,527.76H275.61c-14.35,0-25.12,10.3-23.92,22.9l20.79,218.45c1.2,12.59,12.75,22.9,25.68,22.9h429.58c12.93,0,24.57-10.3,25.89-22.9l22.74-218.45c1.31-12.59-9.36-22.9-23.71-22.9z" />
      {/* Decorative details */}
      <path d="M727.72,792.25c-2.74,30.26,16.93,55.89,46.05,60.7" />
      <path d="M177.69,498.48c5.23,12.83,15.03,24.44,27.75,32.87,13.45,8.96,29.67,13.89,45.73,13.89.15,0,.3,0,.45-.01" />
    </svg>
  );
}

function Header() {
  return (
    <header className="px-4 sm:px-6 py-4 max-w-5xl mx-auto w-full">
      <a href="/" className="inline-flex items-center gap-2 text-[var(--color-accent)] hover:underline">
        <PantryHostLogo size={24} />
        <span
          className="text-xl font-bold text-[var(--color-text-primary)] font-serif"
        >
          Pantry Host
        </span>
      </a>
    </header>
  );
}

function Landing() {
  return (
    <>
      <div className="grid grid-rows-[auto_1fr] min-h-[100svh]">
        <Header />
        <Hero />
      </div>
      <main>
        <Tiers />
        <Features />
        <Integrations />
        <DemoVideos />
        <Docker />
        <RaspberryPi />
        <Philosophy />
      </main>
    </>
  );
}

function AccessibilityPage() {
  return (
    <>
      <Header />
      <main>
        <AccessibilityPreferences />
      </main>
    </>
  );
}

export default function App() {
  return (
    <div className="bg-[var(--color-bg-body)] text-[var(--color-text-primary)] transition-colors">
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/accessibility" element={<AccessibilityPage />} />
      </Routes>
      <Footer />
    </div>
  );
}
