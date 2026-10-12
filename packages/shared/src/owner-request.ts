/**
 * Server-side owner gate for the self-hosted app's settings: a request is the
 * owner's when it reaches the server on a loopback host, or arrives over HTTPS
 * (a TLS-terminating proxy such as `tailscale serve` sets x-forwarded-proto).
 * Plain HTTP on a LAN IP (e.g. a Kindle at http://192.168.x.x:3000) is a guest.
 *
 * Shared by pages/api/settings-read.ts, pages/api/settings-write.ts and the
 * /settings page's getServerSideProps, so the three can't disagree. The Rust
 * server's equivalent is `auth::is_owner` (which also honors PANTRY_TRUST_LAN).
 */
export function isOwnerRequest(headers: Record<string, string | string[] | undefined>): boolean {
  const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';
  const host = first(headers.host).toLowerCase();
  const hostname = host.replace(/:\d+$/, '').replace(/^\[|\]$/g, '');
  const isLoopbackHost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  const isHttps = first(headers['x-forwarded-proto']) === 'https';
  return isLoopbackHost || isHttps;
}
