/**
 * Local in-browser GraphQL executor.
 *
 * Same `gql<T>(query, variables)` API signature as packages/app/lib/gql.ts,
 * but executes GraphQL directly against the in-browser SQLite database
 * (@sqlite.org/sqlite-wasm + OPFS) instead of HTTP POST.
 */

import { graphql, type GraphQLSchema } from 'graphql';

let _schema: GraphQLSchema | null = null;

async function getSchema(): Promise<GraphQLSchema> {
  if (_schema) return _schema;
  // Dynamic import to allow PGlite to initialize first
  const mod = await import('@/lib/schema/index');
  _schema = mod.schema;
  return _schema;
}

export async function gql<T = unknown>(
  query: string,
  variables?: Record<string, unknown>,
): Promise<T> {
  const schema = await getSchema();
  const result = await graphql({ schema, source: query, variableValues: variables });

  if (result.errors?.length) {
    throw new Error(result.errors.map((e) => e.message).join('; '));
  }

  return result.data as T;
}
