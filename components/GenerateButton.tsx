import { useState } from 'react';
import { useRouter } from 'next/router';
import { gql } from '@/lib/gql';
import { SpinnerGap } from '@phosphor-icons/react';

interface Props {
  ingredientCount: number;
}

const GENERATE_MUTATION = `
  mutation GenerateRecipes {
    generateRecipes {
      id
      title
    }
  }
`;

export default function GenerateButton({ ingredientCount }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
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

  return (
    <div>
      <button
        type="button"
        onClick={handleGenerate}
        disabled={loading || ingredientCount === 0}
        aria-busy={loading}
        aria-describedby={error ? 'generate-error' : undefined}
        className="btn-primary text-base px-8 py-4 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <>
            <SpinnerGap size={16} className="animate-spin" aria-hidden />
            Generating…
          </>
        ) : (
          '✦ What can I make?'
        )}
      </button>

      {ingredientCount === 0 && (
        <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
          Add ingredients to your pantry first.{' '}
          <a href="/ingredients#stage" className="underline hover:text-amber-600 dark:hover:text-amber-400">
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

