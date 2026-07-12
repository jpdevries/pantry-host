/**
 * Thin wrapper around the shared `BlueskyCallback` component that
 * feeds it React Router's `useNavigate` as the redirect hook.
 * Mounted at `/oauth/bluesky/callback`.
 */
import { useNavigate } from 'react-router-dom';
import { BlueskyCallback } from '@pantry-host/shared/components/BlueskyCallback';

export default function BlueskyCallbackPage() {
  const navigate = useNavigate();
  return <BlueskyCallback redirect={(to) => navigate(to, { replace: true })} />;
}
