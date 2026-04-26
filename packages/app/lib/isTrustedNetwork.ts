import { isServer } from '@pantry-host/shared/env';

/**
 * Checks whether the current hostname belongs to a trusted local or VPN network.
 * Used to gate owner-only features (e.g. cookware management) when not behind HTTPS.
 *
 * Trusted networks:
 *  - localhost / 127.0.0.1
 *  - LAN mDNS (.local)
 *  - Private IP ranges (10.x, 192.168.x)
 *  - Tailscale CGNAT range (100.64–127.x) and MagicDNS (.ts.net)
 */
export function isTrustedNetwork(hostname: string): boolean {
  if (hostname === 'localhost' || hostname === '127.0.0.1') return true;
  if (hostname.endsWith('.local')) return true;
  if (hostname.endsWith('.ts.net')) return true;
  if (hostname.startsWith('192.168.')) return true;
  if (hostname.startsWith('10.')) return true;

  // Tailscale uses CGNAT range 100.64.0.0/10 (100.64.x.x – 100.127.x.x)
  if (hostname.startsWith('100.')) {
    const second = parseInt(hostname.split('.')[1], 10);
    if (second >= 64 && second <= 127) return true;
  }

  return false;
}

/**
 * Determines if the current user has owner-level access.
 * Owner = localhost (direct machine) or HTTPS (Tailscale cert, mkcert, etc.).
 * Guest = HTTP on a LAN IP (shareable link like http://192.168.x.x:3000).
 */
export function isOwner(): boolean {
  if (isServer) return false;
  const h = window.location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || window.location.protocol === 'https:';
}
