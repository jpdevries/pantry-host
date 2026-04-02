import type { NextApiRequest, NextApiResponse } from 'next';
import os from 'os';

/**
 * Returns the server's LAN IPv4 address.
 * Used by the "Copy Guest Link" button to construct an HTTP LAN URL
 * that WiFi guests can access in read-only mode.
 */
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name] ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) {
        res.setHeader('Cache-Control', 'public, max-age=3600');
        return res.json({ ip: iface.address });
      }
    }
  }
  res.json({ ip: null });
}
