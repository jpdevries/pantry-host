import { HandHeart } from '@phosphor-icons/react';

export default function Philosophy() {
  return (
    <section id="philosophy" className="px-4 sm:px-6 py-16 sm:py-24 max-w-3xl mx-auto text-center">
      <div className="flex justify-center mb-6 text-[var(--color-text-secondary)]">
        <HandHeart size={36} weight="light" />
      </div>
      <h2
        className="text-3xl sm:text-4xl font-bold mb-8"
      >
        No subscription&nbsp;needed
      </h2>
      <p className="text-base sm:text-lg text-[var(--color-text-secondary)] leading-relaxed">
        Pantry&nbsp;Host is open source software you run yourself. There is no cloud service to sunset,
        no pricing tier to upsell, and no terms of service that claim rights to your recipes.
        Your data sits on your hardware, backed up however you choose.
      </p>
    </section>
  );
}
