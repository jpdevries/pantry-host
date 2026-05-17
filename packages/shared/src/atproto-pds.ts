/**
 * DID → PDS endpoint resolver for AT Protocol federation.
 *
 * AT Protocol records live on the author's Personal Data Server (PDS),
 * which is discovered through the DID document — not a single central
 * host. Calling `com.atproto.repo.getRecord` on `bsky.social` only
 * works when the account's PDS *is* `bsky.social`. For every other
 * PDS (e.g. `at.moonshadow.dev`, self-hosted, did:web:*) the call
 * returns RecordNotFound.
 *
 * This module resolves any DID to its authoritative PDS origin, with
 * a 1-hour in-memory cache. Falls back to `https://bsky.social` on
 * failure so existing flows keep working.
 */

/** Fallback PDS when resolution fails. AT Protocol records hosted on
 *  bsky.social itself return fine from here; other PDSs return 404
 *  but that's the same error the caller would hit before this module
 *  existed, so behavior is no worse than the prior state. */
const FALLBACK_PDS = 'https://bsky.social';

/** DID documents change rarely; 1 hour is a reasonable TTL for an
 *  in-memory cache keyed by DID. */
const TTL_MS = 60 * 60 * 1000;

interface CacheEntry {
  endpoint: string;
  expires: number;
}

const pdsCache = new Map<string, CacheEntry>();

interface DidDocService {
  id: string;
  type: string;
  serviceEndpoint: string;
}

interface DidDocument {
  service?: DidDocService[];
}

/** Pull the #atproto_pds endpoint out of a DID document. Some DID
 *  docs use the full-form id (`did:plc:xyz#atproto_pds`); some use
 *  the short form (`#atproto_pds`). Accept both. */
function pdsFromDoc(doc: DidDocument): string | null {
  const svc = doc.service?.find(
    (s) => s.id === '#atproto_pds' || s.id.endsWith('#atproto_pds'),
  );
  if (svc?.type !== 'AtprotoPersonalDataServer') return null;
  // Strip trailing slash so callers can append `/xrpc/...` cleanly.
  return svc.serviceEndpoint.replace(/\/$/, '');
}

async function fetchDidDocument(did: string): Promise<DidDocument | null> {
  try {
    if (did.startsWith('did:plc:')) {
      const res = await fetch(`https://plc.directory/${encodeURIComponent(did)}`);
      if (!res.ok) return null;
      return (await res.json()) as DidDocument;
    }
    if (did.startsWith('did:web:')) {
      // did:web:{host}[:{path*}] → https://{host}[/{path*}]/.well-known/did.json
      const rest = did.slice('did:web:'.length);
      const parts = rest.split(':').map(decodeURIComponent);
      const host = parts[0];
      const path = parts.slice(1).join('/');
      const url = path
        ? `https://${host}/${path}/did.json`
        : `https://${host}/.well-known/did.json`;
      const res = await fetch(url);
      if (!res.ok) return null;
      return (await res.json()) as DidDocument;
    }
    return null;
  } catch {
    return null;
  }
}

/** Resolve a DID to its authoritative PDS origin (e.g.
 *  `https://at.moonshadow.dev`). Result is cached for 1 hour.
 *  Returns the bsky.social fallback on any error. */
export async function resolvePds(did: string): Promise<string> {
  const now = Date.now();
  const cached = pdsCache.get(did);
  if (cached && cached.expires > now) return cached.endpoint;

  const doc = await fetchDidDocument(did);
  const endpoint = (doc && pdsFromDoc(doc)) || FALLBACK_PDS;

  pdsCache.set(did, { endpoint, expires: now + TTL_MS });
  return endpoint;
}

/** Return the base XRPC URL for a DID (e.g.
 *  `https://at.moonshadow.dev/xrpc`). Most callers want this rather
 *  than the bare PDS origin. */
export async function xrpcBaseFor(did: string): Promise<string> {
  const pds = await resolvePds(did);
  return `${pds}/xrpc`;
}

/** Test-only. Flushes the cache between runs so a regression test
 *  can swap network fixtures without stale state leaking in. */
export function __clearPdsCache() {
  pdsCache.clear();
}
