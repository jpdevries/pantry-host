/**
 * "Know what's in your food" spotlight — pitches the opt-in barcode
 * metadata storage and the downstream surfaces it powers
 * (Estimated Nutrition recipe panel, "Contains:" allergens line,
 * per-ingredient Meta info on the edit form, MCP-readable nutrition
 * for AI agents).
 *
 * Sits between Features and Integrations, mirroring the visual rhythm
 * of AtProtocol / ImportFromBluesky so the page reads as one coherent
 * story about open ecosystems.
 *
 * Visual style: cards-with-icons, plus two small inline UI mockups
 * (an ingredient Meta info panel and a recipe Estimated Nutrition
 * panel) so the user can see the actual panels at a glance without
 * bitmap screenshots. Mockups use the same CSS variables as the apps,
 * so they recolor to whatever palette the user has on the marketing
 * site.
 */
import { Heartbeat, Barcode, ShieldCheck, Lock } from '@phosphor-icons/react';

const principles = [
  {
    title: 'Opt-in, off by default',
    description:
      'Storage of barcode + metadata is a single setting, off by default. Toggle it from /settings or directly in the scan modal header.',
    icon: Lock,
  },
  {
    title: 'Allowlisted fields only',
    description:
      'A small, named subset of Open Food\u00a0Facts: nutrition per 100\u202fg + per serving, ingredients text, allergens, Nutri-Score, NOVA group, Eco-Score, brand, labels, categories. Submitter metadata and store lists are deliberately excluded.',
    icon: ShieldCheck,
  },
  {
    title: 'Sits in your DB',
    description:
      'On self-host: a JSONB column on your Postgres. In the browser PWA: PGlite in IndexedDB. Either way, your data, your hardware. MCP agents on your LAN can read it for diet-aware planning.',
    icon: Barcode,
  },
];

/* Tiny UI mockup: the per-ingredient "Meta info" disclosure on the
 * IngredientForm edit panel. Uses the same CSS tokens as the app so
 * it recolors with the user's palette. */
function MetaInfoMockup() {
  return (
    <div className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-4 text-sm">
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
        <Barcode size={12} aria-hidden /> Meta info
      </div>
      <dl className="space-y-1.5">
        <div className="flex gap-3">
          <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] w-20 shrink-0">Barcode</dt>
          <dd><code className="text-xs">015800062110</code></dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] w-20 shrink-0">Brand</dt>
          <dd>C&amp;H</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] w-20 shrink-0">Scores</dt>
          <dd>Nutri-Score E &middot; NOVA 2 &middot; Eco-Score C</dd>
        </div>
        <div className="flex gap-3">
          <dt className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] w-20 shrink-0">Labels</dt>
          <dd className="text-xs">kosher, no gmos, non gmo project</dd>
        </div>
      </dl>
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mt-4 mb-2">
        Nutrition (per 100&thinsp;g)
      </p>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-1.5 text-xs">
        {[
          ['Calories', '375', 'kcal'],
          ['Carbs', '100', 'g'],
          ['Sugar', '100', 'g'],
          ['Protein', '0', 'g'],
          ['Fat', '0', 'g'],
          ['Sodium', '0', 'mg'],
        ].map(([label, value, unit]) => (
          <div key={label}>
            <dt className="text-[var(--color-text-secondary)] uppercase tracking-wider">{label}</dt>
            <dd className="tabular-nums">{value}<span className="text-[var(--color-text-secondary)] ml-1">{unit}</span></dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* Tiny UI mockup: the recipe-level "Estimated Nutrition (per serving)"
 * panel with the partial-coverage caveat. */
function EstimatedNutritionMockup() {
  return (
    <div className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-4 text-sm">
      <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-3">
        Estimated Nutrition (per serving)
      </p>
      <dl className="grid grid-cols-3 gap-x-3 gap-y-2 text-xs">
        {[
          ['Calories', '188', 'kcal'],
          ['Carbs', '50.0', 'g'],
          ['Sugar', '50.0', 'g'],
          ['Protein', '0.0', 'g'],
          ['Fat', '0.0', 'g'],
          ['Sodium', '0', 'mg'],
        ].map(([label, value, unit]) => (
          <div key={label}>
            <dt className="text-[var(--color-text-secondary)] uppercase tracking-wider">{label}</dt>
            <dd className="tabular-nums">
              <span aria-hidden="true" className="text-[var(--color-text-secondary)] mr-0.5">≈</span>
              {value}<span className="text-[var(--color-text-secondary)] ml-1">{unit}</span>
            </dd>
          </div>
        ))}
      </dl>
      <p className="text-xs text-[var(--color-text-secondary)] mt-3 pretty">
        Based on <strong>1</strong> of 3 ingredients from your pantry.
      </p>
      <p className="text-xs text-[var(--color-text-secondary)] mt-2 pretty">
        Estimated from <span className="underline">Open Food Facts</span> data.
        Not a substitute for a nutrition&nbsp;label.
      </p>
    </div>
  );
}

export default function Nutrition() {
  return (
    <section id="nutrition" className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex justify-center mb-4 opacity-60">
        <Heartbeat size={32} weight="light" />
      </div>
      <p className="text-center text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">
        Available now
      </p>
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
        Know what&rsquo;s in your&nbsp;food
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] text-sm sm:text-base max-w-2xl mx-auto mb-12 leading-relaxed pretty">
        Turn on barcode metadata storage and every scanned item carries <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer" className="underline hover:text-[var(--color-accent)]">Open Food&nbsp;Facts</a> data. Recipes surface estimated nutritional information and a &ldquo;Contains:&hellip;&rdquo; allergen rollup &mdash; unioned from your <code className="text-xs">contains-*</code> recipe tags and stored metadata, computed locally.
      </p>

      {/* Two mockups side-by-side at md+, stacked on mobile.
          Mirrors how the panels actually appear in the app. */}
      <div className="grid md:grid-cols-2 gap-6 mb-12">
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 text-center md:text-left">
            On every pantry row
          </p>
          <MetaInfoMockup />
        </div>
        <div>
          <p className="text-xs uppercase tracking-wider text-[var(--color-text-secondary)] mb-2 text-center md:text-left">
            On every recipe
          </p>
          <EstimatedNutritionMockup />
        </div>
      </div>

      <div className="grid sm:grid-cols-3 gap-6">
        {principles.map((p) => (
          <div
            key={p.title}
            className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5"
          >
            <div className="opacity-60 mb-3">
              <p.icon size={24} weight="light" />
            </div>
            <h3 className="text-lg font-bold mb-2">{p.title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed pretty">
              {p.description}
            </p>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-[var(--color-text-secondary)] mt-8 max-w-2xl mx-auto pretty">
        Open Food&nbsp;Facts is a community-built database of product information. Pantry&nbsp;Host stores only the fields it surfaces &mdash; your barcode lookups never leave your hardware once they land.
      </p>
    </section>
  );
}
