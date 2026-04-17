import { useEffect, useState } from 'react';
import { gql } from '@/lib/gql';
import { Robot, ShoppingCart, Leaf } from '@phosphor-icons/react';
import ResponsiveImage from './ResponsiveImage';
import { HIDDEN_TAGS } from '@pantry-host/shared/constants';
import { recipeApiIdFromSourceUrl } from '@pantry-host/shared/recipe-api';
import PixabayImage from '@pantry-host/shared/components/PixabayImage';
import { clearPixabayCache } from '@pantry-host/shared/pixabay';

function recipeSourceHasImages(recipe: { sourceUrl?: string | null }): boolean {
  if (!recipe.sourceUrl) return true;
  if (recipeApiIdFromSourceUrl(recipe.sourceUrl)) return false;
  return true;
}

// ── Module-level singleton for Pixabay settings ─────────────────────────
// RecipeCard is rendered many times on /recipes and /menus. Fetching
// /api/settings-read per card would be wasteful, so we cache the result
// in a module-level promise that all cards share. First card triggers
// the fetch, subsequent cards read from the resolved value. Listeners
// are notified when the value changes (e.g. after Settings page save).

type PixabayState = { key: string | null; enabled: boolean };
let pixabaySettings: PixabayState | null = null;
let pixabayPromise: Promise<PixabayState> | null = null;
const pixabayListeners = new Set<(state: PixabayState) => void>();

async function fetchPixabaySettings(): Promise<PixabayState> {
  try {
    const res = await fetch('/api/settings-read');
    if (!res.ok) return { key: null, enabled: true };
    const body = (await res.json()) as {
      locked?: boolean;
      values?: Record<string, string | null>;
    };
    if (body.locked || !body.values) return { key: null, enabled: true };
    const maskedKey = body.values.PIXABAY_API_KEY;
    // The read route masks secrets. We need the real key for the API call
    // so we ask for reveal mode.
    let realKey: string | null = null;
    if (maskedKey) {
      const revealRes = await fetch('/api/settings-read?reveal=PIXABAY_API_KEY');
      if (revealRes.ok) {
        const revealBody = (await revealRes.json()) as { value?: string | null };
        realKey = revealBody.value ?? null;
      }
    }
    return {
      key: realKey,
      enabled: body.values.PIXABAY_FALLBACK_ENABLED === 'true',
    };
  } catch {
    return { key: null, enabled: false };
  }
}

function usePixabaySettings(): PixabayState {
  const [state, setState] = useState<PixabayState>(() =>
    pixabaySettings ?? { key: null, enabled: false },
  );
  useEffect(() => {
    // Register as a listener so Settings page saves can push updates.
    const listener = (next: PixabayState) => setState(next);
    pixabayListeners.add(listener);
    if (!pixabaySettings && !pixabayPromise) {
      pixabayPromise = fetchPixabaySettings().then((next) => {
        pixabaySettings = next;
        pixabayListeners.forEach((l) => l(next));
        return next;
      });
    } else if (pixabaySettings) {
      setState(pixabaySettings);
    }
    return () => {
      pixabayListeners.delete(listener);
    };
  }, []);
  return state;
}

/** Called from the Settings page after saving so open RecipeCards can
 *  live-update without a reload. Also wipes the borrowed photo cache so
 *  a newly-disabled feature doesn't leave stale photos around. */
export function refreshPixabaySettings(): void {
  pixabayPromise = fetchPixabaySettings().then((next) => {
    const wasEnabled = !!(pixabaySettings && pixabaySettings.enabled && pixabaySettings.key);
    const nowEnabled = !!(next.enabled && next.key);
    if (wasEnabled && !nowEnabled) clearPixabayCache();
    pixabaySettings = next;
    pixabayListeners.forEach((l) => l(next));
    return next;
  });
}

function CartPlus({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M551.991 64H129.28l-8.329-44.423C118.822 8.226 108.911 0 97.362 0H12C5.373 0 0 5.373 0 12v8c0 6.627 5.373 12 12 12h78.72l69.927 372.946C150.305 416.314 144 431.42 144 448c0 35.346 28.654 64 64 64s64-28.654 64-64a63.681 63.681 0 0 0-8.583-32h145.167a63.681 63.681 0 0 0-8.583 32c0 35.346 28.654 64 64 64 35.346 0 64-28.654 64-64 0-17.993-7.435-34.24-19.388-45.868C506.022 391.891 496.76 384 485.328 384H189.28l-12-64h331.381c11.368 0 21.177-7.976 23.496-19.105l43.331-208C578.592 77.991 567.215 64 551.991 64zM464 416c17.645 0 32 14.355 32 32s-14.355 32-32 32-32-14.355-32-32 14.355-32 32-32zm-256 0c17.645 0 32 14.355 32 32s-14.355 32-32 32-32-14.355-32-32 14.355-32 32-32zm294.156-128H171.28l-36-192h406.876l-40 192zM272 196v-8c0-6.627 5.373-12 12-12h36v-36c0-6.627 5.373-12 12-12h8c6.627 0 12 5.373 12 12v36h36c6.627 0 12 5.373 12 12v8c0 6.627-5.373 12-12 12h-36v36c0 6.627-5.373 12-12 12h-8c-6.627 0-12-5.373-12-12v-36h-36c-6.627 0-12-5.373-12-12z" />
    </svg>
  );
}

function CartArrowDown({ size = 14 }: { size?: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 576 512" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M551.991 64H129.28l-8.329-44.423C118.822 8.226 108.911 0 97.362 0H12C5.373 0 0 5.373 0 12v8c0 6.627 5.373 12 12 12h78.72l69.927 372.946C150.305 416.314 144 431.42 144 448c0 35.346 28.654 64 64 64s64-28.654 64-64a63.681 63.681 0 0 0-8.583-32h145.167a63.681 63.681 0 0 0-8.583 32c0 35.346 28.654 64 64 64 35.346 0 64-28.654 64-64 0-17.993-7.435-34.24-19.388-45.868C506.022 391.891 496.76 384 485.328 384H189.28l-12-64h331.381c11.368 0 21.177-7.976 23.496-19.105l43.331-208C578.592 77.991 567.215 64 551.991 64zM240 448c0 17.645-14.355 32-32 32s-32-14.355-32-32 14.355-32 32-32 32 14.355 32 32zm224 32c-17.645 0-32-14.355-32-32s14.355-32 32-32 32 14.355 32 32-14.355 32-32 32zm38.156-192H171.28l-36-192h406.876l-40 192zm-106.641-75.515l-51.029 51.029c-4.686 4.686-12.284 4.686-16.971 0l-51.029-51.029c-7.56-7.56-2.206-20.485 8.485-20.485H320v-52c0-6.627 5.373-12 12-12h8c6.627 0 12 5.373 12 12v52h35.029c10.691 0 16.045 12.926 8.486 20.485z" />
    </svg>
  );
}

interface Recipe {
  id: string;
  slug: string | null;
  title: string;
  cookTime: number | null;
  prepTime: number | null;
  servings: number | null;
  source: string;
  sourceUrl?: string | null;
  tags: string[];
  photoUrl: string | null;
  queued: boolean;
}

type KeyboardMode = 'nav-and-queue' | 'nav-only' | 'queue-only';

interface Props {
  recipe: Recipe;
  recipesBase?: string;
  /**
   * Controls keyboard tab-stop density per card. Set by the /recipes
   * grid's focus-within-revealed User Flow toggle. tabIndex={-1} only
   * removes elements from the keyboard tab order — mouse clicks and
   * assistive-tech navigation-by-role still work.
   */
  keyboardMode?: KeyboardMode;
}

const TOGGLE_QUEUED = `mutation ToggleQueued($id: String!) { toggleRecipeQueued(id: $id) { id queued } }`;

export default function RecipeCard({ recipe, recipesBase = '/recipes', keyboardMode = 'nav-and-queue' }: Props) {
  const titleTabIndex = keyboardMode === 'queue-only' ? -1 : undefined;
  const queueTabIndex = keyboardMode === 'nav-only' ? -1 : undefined;
  const pixabay = usePixabaySettings();
  const pixabayKey = pixabay.key;
  const pixabayEnabled = pixabay.enabled;
  const [queued, setQueued] = useState(recipe.queued);
  const [toggling, setToggling] = useState(false);
  const totalTime = (recipe.prepTime ?? 0) + (recipe.cookTime ?? 0);
  const isGlutenFree = recipe.tags.some((t) => t.toLowerCase() === 'gluten-free');
  const isCannabis = recipe.tags.some((t) => ['420', 'cannabis', 'adult-only'].includes(t.toLowerCase()));
  const isSustainable = recipe.tags.some((t) => ['sustainable', 'local'].includes(t.toLowerCase()));
  const isBreastfeedingSafe = recipe.tags.some((t) => t.toLowerCase() === 'breastfeeding-safe');
  const isLactation = recipe.tags.some((t) => t.toLowerCase() === 'lactation');
  const isBreastfeedingAlert = recipe.tags.some((t) => t.toLowerCase() === 'breastfeeding-alert');
  const isPregnancySafe = recipe.tags.some((t) => t.toLowerCase() === 'pregnancy-safe');
  const isPescatarian = recipe.tags.some((t) => t.toLowerCase() === 'pescatarian');
  const isVegetarian = recipe.tags.some((t) => t.toLowerCase() === 'vegetarian');

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault();
    if (toggling) return;
    setToggling(true);
    setQueued((q) => !q); // optimistic
    try {
      const data = await gql<{ toggleRecipeQueued: { queued: boolean } }>(TOGGLE_QUEUED, { id: recipe.id });
      setQueued(data.toggleRecipeQueued.queued);
    } catch {
      setQueued((q) => !q); // revert on error
    } finally {
      setToggling(false);
    }
  }

  const visibleTags = recipe.tags.filter((t) => !HIDDEN_TAGS.has(t.toLowerCase()));

  // Decide how to render the image zone for row 1 of the subgrid.
  const pixabayActive = pixabayEnabled && !!pixabayKey;
  let imageZone: 'own' | 'pixabay' | 'placeholder' | 'none';
  if (recipe.photoUrl) imageZone = 'own';
  else if (pixabayActive) imageZone = 'pixabay';
  else if (recipeSourceHasImages(recipe)) imageZone = 'placeholder';
  else imageZone = 'none';

  return (
    <div className="card group relative overflow-hidden grid grid-rows-[subgrid] row-span-4">
      {/* Row 1: Photo */}
      {imageZone === 'own' && (
        <div className="aspect-[16/9] overflow-hidden bg-[var(--color-bg-card)]">
          <a href={`${recipesBase}/${recipe.slug ?? recipe.id}#stage`} className="block w-full h-full" tabIndex={-1} aria-hidden="true">
            <ResponsiveImage
              src={recipe.photoUrl!}
              alt={recipe.title}
              className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform"
              loading="lazy"
              sizes="(min-width: 768px) 400px, 100vw"
            />
          </a>
        </div>
      )}
      {imageZone === 'pixabay' && (
        <a href={`${recipesBase}/${recipe.slug ?? recipe.id}#stage`} className="block" tabIndex={-1} aria-hidden="true">
          <PixabayImage
            recipe={{ id: recipe.id, title: recipe.title }}
            apiKey={pixabayKey!}
            alt={recipe.title}
            inCard
          />
        </a>
      )}
      {(imageZone === 'placeholder' || imageZone === 'none') && <div />}

      {/* Row 2: Title + cart button */}
      <div className="px-4 pt-2 flex items-start justify-between gap-2">
        <a
          href={`${recipesBase}/${recipe.slug ?? recipe.id}#stage`}
          className="font-bold text-base leading-snug hover:text-accent transition-colors line-clamp-2"
          tabIndex={titleTabIndex}
        >
          {recipe.title}
        </a>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            aria-label={queued ? `Remove ${recipe.title} from list` : `Add ${recipe.title} to list`}
            aria-pressed={queued}
            tabIndex={queueTabIndex}
            className={`add-to-list-cta w-7 h-7 flex items-center justify-center ${
              queued ? 'is-active' : ''
            }`}
          >
            {queued ? <CartArrowDown size={14} /> : <CartPlus size={14} />}
          </button>
        </div>
      </div>

      {/* Row 3: Metadata */}
      <div className="px-4 flex items-center gap-3 text-sm text-[var(--color-text-secondary)]">
        {totalTime > 0 && (
          <span>
            <time dateTime={`PT${totalTime}M`}>{totalTime} min</time>
          </span>
        )}
        {recipe.servings != null && (
          <span>{recipe.servings} servings</span>
        )}
        {isCannabis && (
          <span className="text-green-600 dark:text-green-400 flex items-center gap-1" title="Contains cannabis">
            <CannabisIcon />
            <span className="sr-only">Contains cannabis</span>
          </span>
        )}
        {isSustainable && (
          <span className="text-green-600 dark:text-green-400 flex items-center gap-1" title="Locally sourced">
            <Leaf size={14} aria-hidden />
            <span className="sr-only">Locally sourced</span>
          </span>
        )}
        {isGlutenFree && (
          <span className="text-green-600 dark:text-green-400 flex items-center gap-1" title="Gluten-free">
            <WheatIcon />
            <span className="sr-only">Gluten-free</span>
          </span>
        )}
        {isBreastfeedingSafe && (
          <span className="text-teal-600 dark:text-teal-400 flex items-center gap-1" title="Breastfeeding safe">
            <ShieldCheckIcon />
            <span className="sr-only">Breastfeeding safe</span>
          </span>
        )}
        {isLactation && (
          <span className="text-teal-600 dark:text-teal-400 flex items-center gap-1" title="Supports lactation">
            <TintIcon />
            <span className="sr-only">Supports lactation</span>
          </span>
        )}
        {isBreastfeedingAlert && (
          <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1" title="Breastfeeding caution">
            <ExclamationTriangleIcon />
            <span className="sr-only">Breastfeeding caution</span>
          </span>
        )}
        {isPregnancySafe && (
          <span className="text-pink-600 dark:text-pink-400 flex items-center gap-1" title="Pregnancy safe">
            <HeartIcon />
            <span className="sr-only">Pregnancy safe</span>
          </span>
        )}
        {isPescatarian && (
          <span className="text-sky-600 dark:text-sky-400 flex items-center gap-1" title="Pescatarian">
            <FishIcon />
            <span className="sr-only">Pescatarian</span>
          </span>
        )}
        {isVegetarian && (
          <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1" title="Vegetarian">
            <CarrotIcon />
            <span className="sr-only">Vegetarian</span>
          </span>
        )}
      </div>

      {/* Row 4: Tags */}
      <div className="px-4 pb-3 self-end">
        {visibleTags.length > 0 && (
          <div className="pt-1 flex flex-wrap gap-1">
            {visibleTags.slice(0, 4).map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
        )}
        {recipe.source === 'ai-generated' && (
          <span className="absolute bottom-2 right-2 text-[var(--color-text-secondary)]" title="AI-generated recipe">
            <Robot size={14} aria-hidden />
            <span className="sr-only">AI-generated</span>
          </span>
        )}
      </div>
    </div>
  );
}


function CannabisIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-cannabis (light) */}
      <path d="M494.42 323.43c-1.2-.6-19.6-9.78-47.96-17.83 48.3-64.24 63.94-129.7 64.72-133.04a31.977 31.977 0 0 0-8.31-29.62 31.997 31.997 0 0 0-22.86-9.61c-2.19 0-4.4.23-6.59.69-3.34.7-66.31 14.35-130.68 55.97-8.59-97.8-57.86-172.39-60.14-175.8C276.64 5.32 266.67 0 256 0s-20.64 5.32-26.58 14.19c-2.29 3.41-51.56 78.01-60.14 175.8-64.37-41.62-127.34-55.27-130.68-55.97-2.19-.46-4.4-.69-6.59-.69-8.51 0-16.78 3.4-22.86 9.61a31.991 31.991 0 0 0-8.31 29.62c.77 3.34 16.42 68.79 64.72 133.04-28.37 8.05-46.77 17.23-47.96 17.83A32 32 0 0 0 0 351.98a32.005 32.005 0 0 0 17.54 28.57c2.3 1.17 54.42 27.19 120.97 29.89-2.84 6.84-4.26 11.06-4.41 11.51A31.999 31.999 0 0 0 164.48 464c3.04 0 6.11-.43 9.12-1.33 1.66-.49 31.46-9.55 66.39-30.71V504c0 4.42 3.58 8 8 8h16c4.42 0 8-3.58 8-8v-72.03c34.94 21.16 64.74 30.21 66.39 30.71 3.01.89 6.08 1.33 9.12 1.33 8.53 0 16.86-3.41 22.97-9.72a31.982 31.982 0 0 0 7.41-32.33c-.15-.45-1.56-4.67-4.41-11.51 66.55-2.71 118.66-28.73 120.97-29.89 10.77-5.45 17.55-16.5 17.54-28.57s-6.79-23.12-17.56-28.56zM362.4 378.66c-17.33 0-31.19-.9-42.49-2.42-.22.12-.4.16-.62.28 19.8 30.01 28.23 55.48 28.23 55.48s-48.08-14.3-91.52-50.5c-43.44 36.2-91.52 50.5-91.52 50.5s8.43-25.47 28.23-55.48c-.22-.12-.4-.16-.62-.28-11.3 1.53-25.16 2.42-42.49 2.42C84.65 378.66 32 352 32 352s40.95-20.67 95.13-25.58c-.85-.8-1.57-1.36-2.43-2.18C53.02 255.98 32 165.33 32 165.33s95.18 20.02 166.85 88.28c.93.89 1.57 1.63 2.48 2.51-.85-11.28-1.33-23.67-1.33-37.46C200 115.57 256 32 256 32s56 83.57 56 186.67c0 13.79-.48 26.18-1.33 37.46.91-.88 1.55-1.62 2.48-2.51C384.82 185.35 480 165.33 480 165.33s-21.02 90.64-92.7 158.9c-.86.82-1.58 1.38-2.43 2.18C439.05 331.33 480 352 480 352s-52.65 26.66-117.6 26.66z" />
    </svg>
  );
}

function WheatIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-wheat (light) — crossed out for gluten-free */}
      <path d="M454.06 171.37c-4.44-4.43-9.24-8.25-14.25-11.64 14.69-5.26 28.28-12.24 39.23-22.42 26.58-28.86 34.78-75.04 32.64-120.09-.44-9.23-8.03-16.47-17.26-16.91-4.28-.19-8.76-.31-13.4-.31-34.31 0-76.99 6.42-105.77 33.15-10.84 10.88-18.32 24.1-23.46 37.97-3.19-4.56-6.61-9.01-10.68-13.07l-34.45-34.43c-6.24-6.24-16.37-6.25-22.62 0L250.33 57.3c-17.5 17.49-26.49 40.07-27.66 62.97l-6.34-6.33c-6.24-6.24-16.37-6.25-22.62 0L160 147.63c-17.58 17.57-26.59 40.28-27.69 63.3l-6.48-6.48c-6.24-6.24-16.37-6.25-22.62 0L69.5 238.14c-37.51 37.49-37.51 98.3 0 135.8l22.96 22.95-87.76 87.8c-6.25 6.25-6.25 16.38 0 22.62C7.81 510.44 11.91 512 16 512s8.19-1.56 11.31-4.69l87.55-87.59 22.84 22.83c18.74 18.73 43.3 28.1 67.87 28.1s49.12-9.37 67.87-28.1l33.77-33.75c6.25-6.25 6.25-16.38 0-22.63l-6.47-6.47c22.98-1.11 45.66-10.11 63.21-27.66l33.77-33.75c6.25-6.25 6.25-16.38 0-22.63l-6.33-6.32c22.87-1.19 45.42-10.16 62.89-27.62l33.77-33.75c6.25-6.25 6.25-16.38 0-22.63l-33.99-33.97zM397.03 56.59c21.59-20.06 56.82-24.48 82.96-24.59-.21 36.03-8.62 65.65-23.67 82.71-21.99 19.63-56.99 23.78-82.66 23.78h-.38c-.34-25.94 3.95-61.99 23.75-81.9zM272.95 79.94l22.4-22.39 23.14 23.12c24.38 24.37 25.42 64.13.69 89.69-.29.25-.66.34-.93.62l-22.38 22.39-22.92-22.91c-25.01-24.99-25.04-65.49 0-90.52zm-90.33 90.33l22.4-22.39 23.14 23.13c13.62 13.62 33.75 53.21 1.95 88.16l-24.55 24.56-22.94-22.93c-25.02-25-25.04-65.5 0-90.53zM92.11 351.31c-25.02-25-25.04-65.5 0-90.53l22.4-22.39 23.14 23.13c23.78 23.76 25.63 62.42 1.75 88.4l-24.33 24.34-22.96-22.95zm158.7 68.61c-25 24.98-65.46 25.01-90.49 0l-22.66-22.65 22.45-22.43c24.99-24.98 65.46-25.02 90.49 0l22.66 22.65-22.45 22.43zm90.51-90.51c-25 24.98-65.46 25.01-90.49 0l-22.66-22.65 22.45-22.43c24.99-24.98 65.46-25.02 90.49 0l22.66 22.65-22.45 22.43zm90.33-90.33c-25 24.98-65.46 25.01-90.49 0l-22.66-22.65L340.95 194c24.99-24.98 65.46-25.02 90.49 0l22.66 22.65-22.45 22.43z" />
    </svg>
  );
}

function ShieldCheckIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-shield-check (light) */}
      <path d="M466.5 83.7l-192-80a48.15 48.15 0 0 0-36.9 0l-192 80C27.7 91.1 16 108.6 16 128c0 198.5 114.5 335.7 221.5 380.3 11.8 4.9 25.1 4.9 36.9 0C360.1 472.6 496 349.3 496 128c0-19.4-11.7-36.9-29.5-44.3zM262.2 478.8c-4 1.6-8.4 1.6-12.3 0C152 440 48 304 48 128c0-6.5 3.9-12.3 9.8-14.8l192-80c3.9-1.6 8.4-1.6 12.3 0l192 80c6 2.5 9.9 8.3 9.8 14.8.1 176-103.9 312-201.7 350.8zm136.2-325c-4.7-4.7-12.3-4.7-17-.1L218 315.8l-69-69.5c-4.7-4.7-12.3-4.7-17-.1l-8.5 8.5c-4.7 4.7-4.7 12.3-.1 17l85.9 86.6c4.7 4.7 12.3 4.7 17 .1l180.5-179c4.7-4.7 4.7-12.3.1-17z" />
    </svg>
  );
}

function TintIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 352 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-tint (light) */}
      <path d="M205.22 22.09C201.21 7.53 188.61 0 175.97 0c-12.35 0-24.74 7.2-29.19 22.09C100.01 179.85 0 222.72 0 333.91 0 432.35 78.72 512 176 512s176-79.65 176-178.09c0-111.75-99.79-153.34-146.78-311.82zM176 480c-79.4 0-144-65.54-144-146.09 0-48.36 23-81.32 54.84-126.94 29.18-41.81 65.34-93.63 89.18-170.91 23.83 77.52 60.06 129.31 89.3 171.08C297.06 252.52 320 285.3 320 333.91 320 414.46 255.4 480 176 480zm0-64c-44.12 0-80-35.89-80-80 0-8.84-7.16-16-16-16s-16 7.16-16 16c0 61.75 50.25 112 112 112 8.84 0 16-7.16 16-16s-7.16-16-16-16z" />
    </svg>
  );
}

function HeartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-heart (light) */}
      <path d="M462.3 62.7c-54.5-46.4-136-38.7-186.6 13.5L256 96.6l-19.7-20.3C195.5 34.1 113.2 8.7 49.7 62.7c-62.8 53.6-66.1 149.8-9.9 207.8l193.5 199.8c6.2 6.4 14.4 9.7 22.6 9.7 8.2 0 16.4-3.2 22.6-9.7L472 270.5c56.4-58 53.1-154.2-9.7-207.8zm-13.1 185.6L256.4 448.1 62.8 248.3c-38.4-39.6-46.4-115.1 7.7-161.2 54.8-46.8 119.2-12.9 142.8 11.5l42.7 44.1 42.7-44.1c23.2-24 88.2-58 142.8-11.5 54 46 46.1 121.5 7.7 161.2z" />
    </svg>
  );
}

function ExclamationTriangleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 576 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-exclamation-triangle (light) */}
      <path d="M270.2 160h35.5c3.4 0 6.1 2.8 6 6.2l-7.5 196c-.1 3.2-2.8 5.8-6 5.8h-20.5c-3.2 0-5.9-2.5-6-5.8l-7.5-196c-.1-3.4 2.6-6.2 6-6.2zM288 388c-15.5 0-28 12.5-28 28s12.5 28 28 28 28-12.5 28-28-12.5-28-28-28zm281.5 52L329.6 24c-18.4-32-64.7-32-83.2 0L6.5 440c-18.4 31.9 4.6 72 41.6 72H528c36.8 0 60-40 41.5-72zM528 480H48c-12.3 0-20-13.3-13.9-24l240-416c6.1-10.6 21.6-10.7 27.7 0l240 416c6.2 10.6-1.5 24-13.8 24z" />
    </svg>
  );
}

function FishIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 640 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-fish (light) */}
      <path d="M363.44 80c-99.96 0-187.27 60.25-235.86 111.79l-97.04-72.66c-3.65-2.73-7.78-3.94-11.8-3.94-10.85 0-20.87 8.78-18.36 20.06L27.27 256 .39 376.74c-2.51 11.28 7.52 20.06 18.36 20.06 4.02 0 8.15-1.21 11.8-3.94l97.04-72.66C176.17 371.75 263.48 432 363.44 432 516.18 432 640 291.2 640 256c0-35.2-123.82-176-276.56-176zm0 320c-86.02 0-166.21-52.56-212.57-101.74l-19.6-20.79-22.87 17.12-68.33 51.17 18.43-82.8 1.55-6.95-1.55-6.95-18.43-82.8 68.33 51.17 22.87 17.12 19.6-20.79C197.23 164.56 277.42 112 363.44 112 489 112 595.86 223.33 607.5 256 595.86 288.67 489 400 363.44 400zM448 232c-13.25 0-24 10.74-24 24 0 13.25 10.75 24 24 24s24-10.75 24-24c0-13.26-10.75-24-24-24z" />
    </svg>
  );
}

function CarrotIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 512 512" fill="currentColor" aria-hidden="true">
      {/* Font Awesome Pro 5.15.4 - fa-carrot (light) */}
      <path d="M504.6 138.5c-22.9-27.6-53.4-43.4-86.4-44.8-1.6-32.1-17.1-63.4-44.7-86.3-5.9-4.9-13.1-7.4-20.4-7.4-7.2 0-14.5 2.5-20.4 7.4-27.2 22.6-43.1 53-44.6 85.8-.7 14.5 1.8 28.7 6.6 42.2-13.3-4.4-26.8-7.3-40.3-7.3-48 0-94.1 26.8-116.6 72.8L2.4 478.3c-3 6.2-3.3 13.8 0 20.5 4.1 8.3 12.4 13.1 21 13.1 3.4 0 6.9-.8 10.2-2.4L311.2 374c25-12.2 46.4-32.6 59.6-59.6 15.4-31.5 16.7-66.2 6.5-97.1 11.8 4.1 23.9 6.6 36.4 6.6 34.7 0 67-15.9 90.9-44.7 9.9-11.7 9.9-28.9 0-40.7zm-162.5 162c-9.6 19.7-25.2 35.3-44.9 44.9l-124.8 60.9c-.4-.5-.6-1.1-1.1-1.6l-32-32c-6.2-6.2-16.4-6.2-22.6 0-6.2 6.2-6.2 16.4 0 22.6l25.6 25.6-100.2 49L154 240.6l26.7 26.7c3.1 3.1 7.2 4.7 11.3 4.7s8.2-1.6 11.3-4.7c6.2-6.2 6.2-16.4 0-22.6l-32-32c-.7-.7-1.7-1.1-2.5-1.7 17.1-31.5 49.4-51 85.6-51 14.9 0 29.2 3.3 42.7 9.9 23.4 11.4 41 31.3 49.5 56s6.9 51.1-4.5 74.6zM413.8 192c-21.5 0-43.1-8.9-60.6-26.5l-6.7-6.7c-37.2-37.1-35.4-92 6.6-126.8 33.2 27.5 41.5 67.6 25.3 101.6 11.2-5.3 23-8 34.9-8 24.1 0 48.3 11.1 66.7 33.3-18.3 22.1-42.3 33.1-66.2 33.1z" />
    </svg>
  );
}

