/**
 * PDS publish receipts — maps a local recipe/menu ID to the AT URI
 * and CID of the record that represents it on the user's personal
 * data server. Populated by the share-to-bluesky flow in
 * `atproto-publish.ts` and read by `PublishToBlueskyButton` so the
 * button can flip to "View on Bluesky" (and offer Re-publish /
 * Unpublish) once a recipe has been pushed.
 *
 * Lives in localStorage rather than the database because:
 *   - the PDS is the source of truth; our DB just points at it
 *   - dry-run receipts (DRYRUN-... rkeys) should be easy to nuke
 *   - swapping to a full PDS-as-backend (Tier 1.5) later shouldn't
 *     need a DB migration
 *
 * Keys are `pds:recipe:${id}` and `pds:menu:${id}` so everything is
 * nicely scoped under a single `pds:` namespace if we ever want to
 * bulk-clear via an iteration.
 */

export type PublishKind = 'recipe' | 'menu';

export interface PublishReceipt {
  /** Full AT URI, e.g. at://did:plc:xyz/exchange.recipe.recipe/3kyb... */
  uri: string;
  /** CID the PDS returned — needed for strongRefs in collections. */
  cid: string;
  /** ISO 8601 timestamp of publish time (local clock). */
  publishedAt: string;
  /** Handle at publish time, e.g. `jpdevries.bsky.social`. Stored
   *  alongside the URI so we can render "View on Bluesky" without
   *  another round-trip to resolve the DID. */
  handle: string;
  /** True if this receipt came from a dry-run publish — the `uri`
   *  and `cid` are synthetic and don't resolve anywhere real. */
  dryRun: boolean;
}

export const PDS_KEY_PREFIX = 'pds';

function keyFor(kind: PublishKind, id: string): string {
  return `${PDS_KEY_PREFIX}:${kind}:${id}`;
}

/** Read the receipt for a given local ID, if one exists. Defensive:
 *  missing or malformed entries resolve to `null` and a later write
 *  repairs the store. SSR-safe. */
export function getPublishReceipt(
  kind: PublishKind,
  id: string,
): PublishReceipt | null {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(keyFor(kind, id));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.uri === 'string' &&
      typeof parsed.cid === 'string' &&
      typeof parsed.publishedAt === 'string' &&
      typeof parsed.handle === 'string'
    ) {
      return {
        uri: parsed.uri,
        cid: parsed.cid,
        publishedAt: parsed.publishedAt,
        handle: parsed.handle,
        dryRun: Boolean(parsed.dryRun),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/** Record a new publish receipt. Overwrites any existing receipt at
 *  the same key (matches the Re-publish flow, where we putRecord at
 *  the same rkey and get a fresh CID). No-op under SSR. */
export function setPublishReceipt(
  kind: PublishKind,
  id: string,
  receipt: PublishReceipt,
): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.setItem(keyFor(kind, id), JSON.stringify(receipt));
}

/** Drop the receipt for a given local ID — call this after an
 *  unpublish (deleteRecord) so the button reverts to "Share to
 *  Bluesky". No-op under SSR and no-op if no entry exists. */
export function clearPublishReceipt(
  kind: PublishKind,
  id: string,
): void {
  if (typeof localStorage === 'undefined') return;
  localStorage.removeItem(keyFor(kind, id));
}

/** True if a recipe/menu has been published at least once from this
 *  origin. Convenience for conditional UI. */
export function isPublished(kind: PublishKind, id: string): boolean {
  return getPublishReceipt(kind, id) !== null;
}

/** Walk every `pds:${kind}:*` key and return a map of id → receipt.
 *  Useful for collection flows that need to know which referenced
 *  recipes already live on the PDS (so we can reuse their
 *  strongRefs instead of re-publishing). SSR-safe (returns empty). */
export function listPublishReceipts(
  kind: PublishKind,
): Record<string, PublishReceipt> {
  if (typeof localStorage === 'undefined') return {};
  const prefix = `${PDS_KEY_PREFIX}:${kind}:`;
  const result: Record<string, PublishReceipt> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key || !key.startsWith(prefix)) continue;
    const id = key.slice(prefix.length);
    const receipt = getPublishReceipt(kind, id);
    if (receipt) result[id] = receipt;
  }
  return result;
}
