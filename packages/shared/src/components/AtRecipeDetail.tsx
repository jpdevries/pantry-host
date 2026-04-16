/**
 * Shared AT Protocol recipe detail + import CTA.
 *
 * Renders a full recipe detail view for an exchange.recipe.recipe record
 * fetched from the AT Protocol network. Used by both packages/app (Rex)
 * and packages/web (PGlite) as the `/at/*` route handler.
 *
 * The caller provides:
 * - `atUri`: the canonical AT URI to fetch
 * - `onImport(recipe)`: callback to run the createRecipe mutation
 * - `checkDuplicate(atUri)`: check if already imported (returns slug or null)
 * - `recipeBasePath`: e.g. "/recipes" or "/kitchens/home/recipes"
 * - `shareUrl`: the full page URL for QR code / clipboard
 */
import { useState, useEffect, useCallback } from 'react';
import { fetchBlueskyRecipe, parseAtUri, isRecipeUri, type ParsedRecipe } from '../bluesky';
import { groupIngredients } from '../ingredient-groups';
import QRCodeModal from './QRCodeModal';
import { ShareNetwork, ArrowSquareIn, Warning, SpinnerGap } from '@phosphor-icons/react';

interface AtRecipeDetailProps {
  atUri: string;
  shareUrl: string;
  recipeBasePath: string;
  onImport: (recipe: ParsedRecipe) => Promise<{ slug: string }>;
  checkDuplicate: (sourceUrl: string) => Promise<string | null>;
  /** Navigate to a local recipe — app uses <a href>, web uses router.navigate */
  renderRecipeLink: (slug: string, children: React.ReactNode) => React.ReactNode;
}

type PageState =
  | { kind: 'loading' }
  | { kind: 'recipe'; recipe: ParsedRecipe; existingSlug: string | null }
  | { kind: 'importing'; recipe: ParsedRecipe }
  | { kind: 'imported'; slug: string }
  | { kind: 'error'; message: string };

export default function AtRecipeDetail({
  atUri,
  shareUrl,
  recipeBasePath,
  onImport,
  checkDuplicate,
  renderRecipeLink,
}: AtRecipeDetailProps) {
  const [state, setState] = useState<PageState>({ kind: 'loading' });
  const [qrOpen, setQrOpen] = useState(false);

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const recipe = await fetchBlueskyRecipe(atUri);
      const existingSlug = await checkDuplicate(atUri);
      setState({ kind: 'recipe', recipe, existingSlug });
    } catch (err) {
      setState({ kind: 'error', message: (err as Error).message });
    }
  }, [atUri, checkDuplicate]);

  useEffect(() => { load(); }, [load]);

  async function handleImport() {
    if (state.kind !== 'recipe') return;
    const { recipe } = state;
    setState({ kind: 'importing', recipe });
    try {
      const { slug } = await onImport(recipe);
      setState({ kind: 'imported', slug });
    } catch (err) {
      setState({ kind: 'error', message: `Import failed: ${(err as Error).message}` });
    }
  }

  // ── Loading ──
  if (state.kind === 'loading') {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4 flex items-center gap-3 text-[var(--color-text-secondary)]">
        <SpinnerGap size={20} className="animate-spin" />
        Fetching recipe from the AT Protocol network…
      </div>
    );
  }

  // ── Error ──
  if (state.kind === 'error') {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="card p-6 flex items-start gap-3">
          <Warning size={20} className="shrink-0 mt-0.5 text-red-400" />
          <div>
            <p className="font-semibold mb-1">Couldn't load recipe</p>
            <p className="text-sm text-[var(--color-text-secondary)] legible pretty">{state.message}</p>
            <button onClick={load} className="btn-secondary text-sm mt-3">Try again</button>
          </div>
        </div>
      </div>
    );
  }

  // ── Imported — redirect ──
  if (state.kind === 'imported') {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div className="card p-6 text-center">
          <p className="font-semibold mb-2">Recipe imported</p>
          {renderRecipeLink(state.slug, (
            <span className="text-accent hover:underline">View in your pantry →</span>
          ))}
        </div>
      </div>
    );
  }

  // ── Recipe detail (recipe or importing state) ──
  const recipe = state.kind === 'importing' ? state.recipe : state.recipe;
  const existingSlug = state.kind === 'recipe' ? state.existingSlug : null;
  const importing = state.kind === 'importing';

  const parsed = parseAtUri(atUri);
  const handle = recipe.description?.match(/@([\w.-]+) on Bluesky/)?.[1];

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* ── Import CTA bar ── */}
      <div className="card p-4 mb-6 flex flex-wrap items-center gap-3">
        {handle && (
          <span className="text-sm text-[var(--color-text-secondary)]">
            by <a href={`https://bsky.app/profile/${handle}`} target="_blank" rel="noopener noreferrer" className="underline">@{handle}</a>
          </span>
        )}
        <div className="flex-1" />
        <button
          onClick={() => setQrOpen(true)}
          className="btn-secondary text-sm flex items-center gap-1.5"
          aria-label="Share QR code"
        >
          <ShareNetwork size={16} />
          Share
        </button>
        {existingSlug ? (
          renderRecipeLink(existingSlug, (
            <span className="btn-secondary text-sm inline-flex items-center gap-1.5">
              Already in your pantry →
            </span>
          ))
        ) : (
          <button
            onClick={handleImport}
            disabled={importing}
            className="btn-primary text-sm flex items-center gap-1.5"
          >
            <ArrowSquareIn size={16} />
            {importing ? 'Importing…' : 'Import to your pantry'}
          </button>
        )}
      </div>

      {/* ── Photo ── */}
      {recipe.photoUrl && (
        <img
          src={recipe.photoUrl}
          alt={recipe.title}
          className="w-full rounded-xl mb-6 object-cover max-h-96"
          loading="lazy"
        />
      )}

      {/* ── Title ── */}
      <h1 className="text-3xl font-bold mb-2">{recipe.title}</h1>

      {/* ── Meta ── */}
      <div className="flex flex-wrap gap-4 text-sm text-[var(--color-text-secondary)] mb-6">
        {recipe.servings != null && <span>Serves {recipe.servings}</span>}
        {recipe.prepTime != null && <span>Prep {recipe.prepTime}m</span>}
        {recipe.cookTime != null && <span>Cook {recipe.cookTime}m</span>}
      </div>

      {/* ── Description ── */}
      {recipe.description && (
        <p className="text-[var(--color-text-secondary)] mb-6 legible pretty whitespace-pre-line">
          {recipe.description}
        </p>
      )}

      {/* ── Tags ── */}
      {recipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-6">
          {recipe.tags.filter((t) => t !== 'bluesky').map((tag) => (
            <span key={tag} className="tag">{tag}</span>
          ))}
        </div>
      )}

      {/* ── Ingredients ── */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Ingredients</h2>
        {groupIngredients(recipe.ingredients).map((g, gi) => {
          const list = (
            <ul className="space-y-1.5">
              {g.items.map((ing, ii) => (
                <li key={ii} className="text-sm">
                  {ing.quantity != null && <span className="font-medium">{Math.round(ing.quantity * 100) / 100}</span>}
                  {ing.unit && <span className="text-[var(--color-text-secondary)]"> {ing.unit}</span>}
                  {' '}{ing.ingredientName}
                </li>
              ))}
            </ul>
          );
          if (!g.group) return <div key={`g-${gi}`}>{list}</div>;
          return (
            <fieldset key={`g-${gi}`} className="mt-4 first:mt-0">
              <legend className="text-sm font-semibold uppercase tracking-wider text-[var(--color-text-secondary)] mb-2">{g.group}</legend>
              {list}
            </fieldset>
          );
        })}
      </section>

      {/* ── Instructions ── */}
      <section className="mb-8">
        <h2 className="text-xl font-semibold mb-3">Instructions</h2>
        <div className="prose prose-sm max-w-none text-[var(--color-text-primary)] legible pretty whitespace-pre-line">
          {recipe.instructions}
        </div>
      </section>

      {/* ── Source ── */}
      <p className="text-xs text-[var(--color-text-secondary)]">
        Source: <a href={atUri.replace('at://', 'https://bsky.app/profile/').replace(/\/exchange\.recipe\.recipe\//, '/post/')} target="_blank" rel="noopener noreferrer" className="underline">AT Protocol</a>
      </p>

      <QRCodeModal url={shareUrl} open={qrOpen} onClose={() => setQrOpen(false)} />
    </div>
  );
}
