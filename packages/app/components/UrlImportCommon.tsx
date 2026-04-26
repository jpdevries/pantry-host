/**
 * Shared logic for /http/* and /https/* Rex catch-all pages.
 *
 * Reconstructs the full URL from window.location.pathname (Rex's
 * useRouter().query is unreliable in prod — CLAUDE.md gotcha #9),
 * scrapes via the local fetch-recipe API, runs the CreateRecipe
 * mutation on confirm, and renders the shared UrlRecipeDetail.
 */
import { useState, useEffect, useCallback } from 'react';
import Head from 'next/head';
import UrlRecipeDetail from '@pantry-host/shared/components/UrlRecipeDetail';
import type { ParsedRecipe } from '@pantry-host/shared/bluesky';
import { gql } from '@/lib/gql';
import { apiUrl } from '@/lib/apiUrl';
import { isServer } from '@pantry-host/shared/env';

const CREATE_RECIPE = `
  mutation CreateRecipe(
    $title: String!, $description: String, $instructions: String!,
    $servings: Int, $prepTime: Int, $cookTime: Int,
    $tags: [String!], $photoUrl: String, $sourceUrl: String,
    $ingredients: [RecipeIngredientInput!]!
  ) {
    createRecipe(
      title: $title, description: $description, instructions: $instructions,
      servings: $servings, prepTime: $prepTime, cookTime: $cookTime,
      tags: $tags, photoUrl: $photoUrl, sourceUrl: $sourceUrl,
      ingredients: $ingredients
    ) { id slug }
  }
`;

const RECIPES_QUERY = `{ recipes { id slug sourceUrl } }`;

function decodeSegments(path: string): string {
  return path.split('/').map((s) => {
    try { return decodeURIComponent(s); } catch { return s; }
  }).join('/');
}

function getSourceUrl(scheme: 'http' | 'https'): string | null {
  if (isServer) return null;
  const prefix = `/${scheme}/`;
  const path = window.location.pathname;
  if (!path.startsWith(prefix)) return null;
  const wildcard = path.slice(prefix.length);
  return `${scheme}://${decodeSegments(wildcard)}${window.location.search}${window.location.hash}`;
}

export default function UrlImportCommon({ scheme }: { scheme: 'http' | 'https' }) {
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);

  useEffect(() => {
    setSourceUrl(getSourceUrl(scheme));
  }, [scheme]);

  const fetcher = useCallback(async (url: string) => {
    const res = await fetch(apiUrl('/fetch-recipe'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body?.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  }, []);

  const handleImport = useCallback(async (recipe: ParsedRecipe) => {
    const data = await gql<{ createRecipe: { id: string; slug: string } }>(CREATE_RECIPE, {
      title: recipe.title,
      description: recipe.description ?? null,
      instructions: recipe.instructions,
      servings: recipe.servings ?? null,
      prepTime: recipe.prepTime ?? null,
      cookTime: recipe.cookTime ?? null,
      tags: recipe.tags,
      photoUrl: recipe.photoUrl ?? null,
      sourceUrl: recipe.sourceUrl,
      ingredients: recipe.ingredients.map((i) => ({
        ingredientName: i.ingredientName,
        quantity: i.quantity ?? null,
        unit: i.unit ?? null,
      })),
    });
    return { slug: data.createRecipe.slug };
  }, []);

  const checkDuplicate = useCallback(async (url: string) => {
    const data = await gql<{ recipes: { id: string; slug: string; sourceUrl: string | null }[] }>(RECIPES_QUERY);
    const match = data.recipes.find((r) => r.sourceUrl === url);
    return match?.slug ?? null;
  }, []);

  const renderRecipeLink = useCallback((slug: string, children: React.ReactNode) => (
    <a href={`/recipes/${slug}#stage`}>{children}</a>
  ), []);

  const renderManualImportLink = useCallback((url: string, children: React.ReactNode) => (
    <a href={`/recipes/import?url=${encodeURIComponent(url)}#stage`}>{children}</a>
  ), []);

  if (sourceUrl === null) {
    return (
      <>
        <Head><title>Importing recipe | Pantry Host</title></Head>
        <div className="max-w-3xl mx-auto py-12 px-4">
          <p className="text-[var(--color-text-secondary)]">Loading…</p>
        </div>
      </>
    );
  }

  try { new URL(sourceUrl); } catch {
    return (
      <>
        <Head><title>Invalid URL | Pantry Host</title></Head>
        <div className="max-w-3xl mx-auto py-12 px-4">
          <div className="card p-6">
            <p className="font-semibold mb-1">Invalid URL</p>
            <p className="text-sm text-[var(--color-text-secondary)] break-all">{sourceUrl}</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Import Recipe | Pantry Host</title>
        <meta name="description" content="Import a recipe from a web URL into your Pantry Host." />
      </Head>
      <UrlRecipeDetail
        sourceUrl={sourceUrl}
        fetcher={fetcher}
        onImport={handleImport}
        checkDuplicate={checkDuplicate}
        renderRecipeLink={renderRecipeLink}
        renderManualImportLink={renderManualImportLink}
      />
    </>
  );
}
