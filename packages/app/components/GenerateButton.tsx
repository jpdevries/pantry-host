import { useState } from 'react';
import { useRouter } from 'next/router';
import { gql } from '@/lib/gql';
import { SpinnerGap } from '@phosphor-icons/react';

interface CookwareItem {
  id: string;
  name: string;
  tags: string[];
  notes: string | null;
}

interface Props {
  ingredientCount: number;
  cookware?: CookwareItem[];
}

const GENERATE_MUTATION = `
  mutation GenerateRecipes {
    generateRecipes {
      id
      title
    }
  }
`;

const UPDATE_COOKWARE = `
  mutation UpdateCookware($id: String!, $notes: String) {
    updateCookware(id: $id, notes: $notes) { id notes }
  }
`;

export default function GenerateButton({ ingredientCount, cookware = [] }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promptItem, setPromptItem] = useState<CookwareItem | null>(null);
  const [notesInput, setNotesInput] = useState('');

  // Find composting cookware missing notes
  const compostersWithoutNotes = cookware.filter(
    (c) => c.tags.some((t) => ['waste-cycler', 'compost'].includes(t)) && !c.notes,
  );

  async function handleGenerate() {
    // Prompt for missing composting notes first
    if (compostersWithoutNotes.length > 0 && !promptItem) {
      setPromptItem(compostersWithoutNotes[0]);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const data = await gql<{ generateRecipes: { id: string }[] }>(GENERATE_MUTATION);
      if (data.generateRecipes.length > 0) {
        router.push('/recipes#stage');
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSaveNotes() {
    if (!promptItem || !notesInput.trim()) return;
    try {
      await gql(UPDATE_COOKWARE, { id: promptItem.id, notes: notesInput.trim() });
      // Update local state so we don't prompt again
      promptItem.notes = notesInput.trim();
      setPromptItem(null);
      setNotesInput('');
      // Now proceed with generation
      handleGenerate();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <div>
      {promptItem && (
        <div className="mb-4 p-4 rounded-lg border border-[var(--color-border-card)] bg-[var(--color-bg-card)]">
          <p className="text-sm font-medium mb-2">
            You have a <strong>{promptItem.name}</strong> but we don&rsquo;t have its composting rules yet.
          </p>
          <p className="text-xs text-[var(--color-text-secondary)] mb-3">
            Paste or describe what it can and can&rsquo;t process so we can include composting tips in generated recipes.
          </p>
          <textarea
            value={notesInput}
            onChange={(e) => setNotesInput(e.target.value)}
            placeholder="e.g. Accepts fruit scraps, veggie scraps, eggshells, coffee grounds. Does NOT accept meat, dairy, oils, or bones."
            className="field-input w-full mb-3"
            rows={3}
            autoFocus
          />
          <div className="flex gap-3">
            <button type="button" onClick={handleSaveNotes} disabled={!notesInput.trim()} className="btn-primary text-sm disabled:opacity-50">
              Save &amp; Generate
            </button>
            <button type="button" onClick={() => { setPromptItem(null); handleGenerate(); }} className="btn-secondary text-sm">
              Skip
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || ingredientCount === 0}
        aria-busy={loading}
        aria-describedby={error ? 'generate-note generate-error' : 'generate-note'}
        className="btn-primary text-base px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <SpinnerGap size={16} className="animate-spin" aria-hidden />
            Generating…
          </>
        ) : (
          <>
            <span aria-hidden="true">✦</span> What can I make?{' '}
            {/* Inside the button so "Experimental" is part of its accessible name. */}
            <span className="tag rounded-full">Experimental</span>
          </>
        )}
      </button>

      <p id="generate-note" className="mt-3 text-sm text-[var(--color-text-secondary)]">
        Experimental: ideas to riff on, not tested recipes. AI does better adapting recipes you already have.
      </p>

      {ingredientCount === 0 && (
        <p className="mt-3 text-sm text-[var(--color-text-secondary)]">
          Add ingredients to your pantry first.{' '}
          <a href="/ingredients#stage" className="underline hover:text-accent">
            Go to Pantry →
          </a>
        </p>
      )}

      {error && (
        <p id="generate-error" role="alert" className="mt-3 text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
    </div>
  );
}
