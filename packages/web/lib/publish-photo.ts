/**
 * OPFS-aware photo resolver for Share-to-Bluesky publishes.
 *
 * The web PWA stores uploaded recipe photos in OPFS and records
 * them as `opfs://{filename}` in `photoUrl` — a scheme `fetch()`
 * can't reach, so the shared default resolver skips them. This
 * resolver reads OPFS files directly and delegates everything else
 * (external URLs, blob:/data: URLs) to the shared default.
 *
 * Pass as the `fetchPhoto` prop on `PublishToBlueskyButton`.
 */

import { fetchPhotoBlob } from '@pantry-host/shared/atproto-publish';
import { opfsStorage } from '@/lib/storage-opfs';

export async function fetchPhotoForPublish(photoUrl: string): Promise<Blob | null> {
  if (photoUrl.startsWith('opfs://')) {
    try {
      return await opfsStorage.getFile(photoUrl.replace('opfs://', ''));
    } catch {
      console.warn('[publish-photo] OPFS file missing; publishing without it', photoUrl);
      return null;
    }
  }
  return fetchPhotoBlob(photoUrl);
}
