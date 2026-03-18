const iconProps = { xmlns: 'http://www.w3.org/2000/svg', width: 16, height: 16, fill: 'currentColor', 'aria-hidden': true as const };

function LemonIcon() {
  return (
    <svg viewBox="0 0 512 512" {...iconProps}>
      <path d="M489.038 22.963C473.784 7.709 454.948 0 437.954 0c-8.734 0-16.98 2.035-24.007 6.129-58.912 34.315-181.245-53.083-321.073 86.745C-46.948 232.697 40.441 355.041 6.129 413.945c-12.059 20.702-6.26 51.999 16.833 75.093 23.08 23.08 54.378 28.899 75.095 16.832 58.902-34.31 181.245 53.081 321.068-86.743C558.949 279.304 471.56 156.96 505.871 98.056c12.059-20.702 6.261-51.999-16.833-75.093zM478.22 81.95c-44.546 76.475 49.666 183.163-81.721 314.55-131.434 131.434-238.029 37.148-314.547 81.72-20.528 11.956-60.128-27.64-48.171-48.167 44.547-76.475-49.667-183.163 81.721-314.55C246.942-15.939 353.523 78.359 430.053 33.78c19.978-11.637 60.439 27.102 48.167 48.17zm-218.749 29.669c-31.89 7.086-64.973 26.511-93.157 54.694-28.184 28.185-47.608 61.268-54.694 93.157-1.657 7.457-8.271 12.533-15.604 12.533-1.149 0-2.316-.125-3.485-.385-8.626-1.917-14.065-10.464-12.148-19.09 8.391-37.756 30.872-76.41 63.306-108.843 32.433-32.434 71.087-54.915 108.843-63.306 8.628-1.919 17.173 3.522 19.09 12.148s-3.525 17.175-12.151 19.092z" />
    </svg>
  );
}

export default function Footer() {
  return (
    <footer className="no-print border-t border-zinc-200 dark:border-zinc-800 mt-16 pt-10 pb-8 px-4 sm:px-6 text-xs text-zinc-500 dark:text-zinc-400">
      <div className="max-w-5xl mx-auto">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-8 mb-8">
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Volume</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 cup</dt> <dd className="inline">= 16 tbsp</dd></div>
              <div><dt className="inline font-medium">1 tbsp</dt> <dd className="inline">= 3 tsp</dd></div>
              <div><dt className="inline font-medium">1 cup</dt> <dd className="inline">= 237 ml</dd></div>
              <div><dt className="inline font-medium">1 fl oz</dt> <dd className="inline">= 30 ml</dd></div>
              <div><dt className="inline font-medium">1 quart</dt> <dd className="inline">= 4 cups</dd></div>
              <div><dt className="inline font-medium">1 gallon</dt> <dd className="inline">= 4 quarts</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Weight</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 oz</dt> <dd className="inline">= 28.35 g</dd></div>
              <div><dt className="inline font-medium">1 lb</dt> <dd className="inline">= 16 oz</dd></div>
              <div><dt className="inline font-medium">1 lb</dt> <dd className="inline">= 454 g</dd></div>
              <div><dt className="inline font-medium">1 kg</dt> <dd className="inline">= 2.2 lb</dd></div>
              <div><dt className="inline font-medium">1 stick butter</dt> <dd className="inline">= 113 g</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Temperature</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">250 °F</dt> <dd className="inline">= 121 °C</dd></div>
              <div><dt className="inline font-medium">350 °F</dt> <dd className="inline">= 177 °C</dd></div>
              <div><dt className="inline font-medium">400 °F</dt> <dd className="inline">= 204 °C</dd></div>
              <div><dt className="inline font-medium">450 °F</dt> <dd className="inline">= 232 °C</dd></div>
              <div><dt className="inline font-medium">750 °F</dt> <dd className="inline">= 399 °C</dd></div>
            </dl>
          </div>
          <div>
            <h3 className="font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-3">Handy</h3>
            <dl className="space-y-1">
              <div><dt className="inline font-medium">1 clove garlic</dt> <dd className="inline">≈ 1 tsp</dd></div>
              <div><dt className="inline font-medium">1 lemon</dt> <dd className="inline">≈ 3 tbsp juice</dd></div>
              <div><dt className="inline font-medium">1 lime</dt> <dd className="inline">≈ 2 tbsp juice</dd></div>
              <div><dt className="inline font-medium">1 egg</dt> <dd className="inline">≈ 50 g</dd></div>
              <div><dt className="inline font-medium">Pinch</dt> <dd className="inline">≈ ⅛ tsp</dd></div>
            </dl>
          </div>
        </div>
        <div className="flex items-center gap-2 text-zinc-400 dark:text-zinc-500">
          <LemonIcon />
          <span>Pantry List</span>
        </div>
      </div>
    </footer>
  );
}
