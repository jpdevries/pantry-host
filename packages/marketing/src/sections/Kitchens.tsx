import { HouseLine, HouseSimple, UsersThree, ForkKnife, ArrowRight } from '@phosphor-icons/react';

const useCases = [
  {
    title: 'Home & Away',
    icon: HouseSimple,
    description:
      'Separate pantries for your house and vacation cabin. Each kitchen tracks its own ingredients, recipes, and grocery list.',
  },
  {
    title: 'Shared Households',
    icon: UsersThree,
    description:
      'Self-host on a Mac Mini or Raspberry Pi. Everyone in the house sees the same pantry, synced across every device.',
  },
  {
    title: 'Catering & Events',
    icon: ForkKnife,
    description:
      'One kitchen per event. Track ingredients and menus independently, then archive or delete when the event is over.',
  },
];

export default function Kitchens() {
  return (
    <section id="kitchens" className="px-4 sm:px-6 py-16 sm:py-24 max-w-5xl mx-auto">
      <div className="flex justify-center mb-4 opacity-60">
        <HouseLine size={32} weight="light" />
      </div>
      <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
        Kitchens for&nbsp;Everyone
      </h2>
      <p className="text-center text-[var(--color-text-secondary)] text-sm sm:text-base max-w-2xl mx-auto mb-10 leading-relaxed">
        Your home kitchen, Grandma&rsquo;s house, a vacation cabin, a catering gig.
        Each kitchen has its own pantry, recipes, menus, cookware, and grocery&nbsp;list.
        Available on all three&nbsp;tiers.
      </p>
      <div className="grid sm:grid-cols-3 gap-6 mb-10">
        {useCases.map((uc) => (
          <div
            key={uc.title}
            className="rounded-xl border border-[var(--color-border-card)] bg-[var(--color-bg-card)] p-5"
          >
            <div className="mb-3 opacity-60">
              <uc.icon size={24} weight="light" />
            </div>
            <h3 className="text-lg font-bold mb-2">{uc.title}</h3>
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {uc.description}
            </p>
          </div>
        ))}
      </div>
      <div className="text-center">
        <a
          href="https://my.pantryhost.app/kitchens"
          className="inline-flex items-center justify-center px-5 py-2.5 text-sm font-semibold rounded-lg border border-[var(--color-border-card)] text-[var(--color-text-primary)] hover:underline transition-colors"
        >
          Access your kitchen now <ArrowRight size={16} weight="bold" aria-hidden className="ml-1" />
        </a>
      </div>
    </section>
  );
}
