/**
 * Rex route at /oauth/bluesky/callback. Wraps the shared
 * BlueskyCallback body and navigates via plain window.location.href
 * after auth settles (Rex has no <Link>-style client router).
 */
import { BlueskyCallback } from '@pantry-host/shared/components/BlueskyCallback';

export default function BlueskyCallbackPage() {
  return (
    <BlueskyCallback
      redirect={(to) => {
        // Use replace rather than href to avoid polluting history
        // with the callback entry.
        if (typeof window !== 'undefined') {
          window.location.replace(to);
        }
      }}
    />
  );
}
