import { ShoppingCart } from '@phosphor-icons/react';
import ThemedVideo from '../components/ThemedVideo';
import LazyVideo from '../components/LazyVideo';

export default function DemoVideos() {
  return (
    <section className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex flex-col items-center mb-10">
        <div className="opacity-60 mb-4">
          <ShoppingCart size={32} weight="light" />
        </div>
        <h2 className="text-4xl sm:text-5xl font-bold text-center">
          See Pantry Host in&nbsp;action
        </h2>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 sm:grid-rows-[1fr_auto_auto] gap-x-8 gap-y-8 sm:gap-y-0">
        <ThemedVideo
          name="queue-recipe-mobile"
          caption="Browse and queue recipes to inform your grocery list."
          muted
          loop
          playsInline
          controls
          className="w-full rounded-xl shadow-2xl border border-[var(--color-border-card)]"
          figureClassName="grid grid-rows-subgrid row-span-3 items-end"
          captionClassName="mt-4 text-sm text-[var(--color-text-secondary)] font-serif text-center self-start pretty"
        />
        <figure className="grid grid-rows-subgrid row-span-3 items-end">
          <div />
          <LazyVideo
            muted
            loop
            playsInline
            controls
            aria-label="Demo: Manage your pantry conversationally with Siri"
            poster="/videos/posters/siri.jpg"
            preload="metadata"
            className="w-full rounded-xl shadow-2xl border border-[var(--color-border-card)]"
          >
            <source src="/videos/siri.webm" type="video/webm" />
            <source src="/videos/siri.mp4" type="video/mp4" />
          </LazyVideo>
          <figcaption className="mt-4 text-sm text-[var(--color-text-secondary)] font-serif text-center self-start pretty">
            Manage your pantry conversationally with Siri.
          </figcaption>
        </figure>
        <figure className="grid grid-rows-subgrid row-span-3 items-end">
          <div />
          <LazyVideo
            muted
            loop
            playsInline
            controls
            aria-label="Demo: Scan barcodes to add ingredients on the go"
            poster="/videos/posters/barcode.jpg"
            preload="metadata"
            className="w-full rounded-xl shadow-2xl border border-[var(--color-border-card)]"
          >
            <source src="/videos/barcode.webm" type="video/webm" />
            <source src="/videos/barcode.mp4" type="video/mp4" />
          </LazyVideo>
          <figcaption className="mt-4 text-sm text-[var(--color-text-secondary)] font-serif text-center self-start pretty">
            Scan barcodes to add ingredients on the go.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
