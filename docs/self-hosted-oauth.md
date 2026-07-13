# Self-hosted OAuth sovereignty (Share to Bluesky)

Publishing recipes to Bluesky (Share to Bluesky) is **entirely client-side**:
your browser talks OAuth + DPoP directly to your PDS and writes the records.
The Pantry Host backend is never involved.

AT Protocol OAuth identifies a client by a **public HTTPS document** whose URL
*is* the `client_id`. That document lists the `redirect_uris` the authorization
server will hand a token back to. A self-hosted instance reached at, say,
`https://recipes.example.com` therefore can't just complete OAuth on its own —
the hosted `pantryhost.app` client metadata doesn't list your callback.

Pantry Host gives you **two ways** to publish from a self-hosted instance:

| Path | What happens | Dependency |
|---|---|---|
| **Broker (default)** | Off `127.0.0.1`, sign-in + writes route through a popup on `my.pantryhost.app/publish-broker`. Your browser still writes to *your* PDS; pantryhost.app just holds the OAuth client. | Relies on pantryhost.app being up. |
| **Sovereign (this doc)** | You host your own `client-metadata.json`; OAuth completes directly against your origin. No pantryhost.app in the loop. | You run a public HTTPS endpoint. |

Both write to your own repo on your own PDS. The broker is the zero-config
default; sovereignty is for self-hosters who want no third-party dependency in
their publish path.

> **Loopback shortcut:** reaching the app at `http://127.0.0.1:3000` on the box
> itself uses the AT spec's loopback client and needs none of this. Sovereignty
> matters when you reach the instance at a real address — a LAN IP, a Tailscale
> hostname, or a reverse-proxied domain.

## Requirements

- The instance must be reachable over **public HTTPS** at a stable origin
  (e.g. `https://recipes.example.com`). AT OAuth requires the `client_id`
  document to be fetchable by the authorization server over HTTPS — a
  `.local`/LAN-only/`http://` origin will not work for the sovereign path.
  (A Tailscale-serve HTTPS hostname like `https://box.tailXXXX.ts.net` works.)
- The app must serve a static file at `/client-metadata.json` at that origin.

## Steps

### 1. Generate your client metadata

```bash
npx tsx packages/app/scripts/gen-client-metadata.ts https://recipes.example.com \
  -o packages/app/public/client-metadata.json
```

Optionally name the client (shown on the Bluesky consent screen):

```bash
npx tsx packages/app/scripts/gen-client-metadata.ts https://recipes.example.com \
  --name "Example Kitchen" -o packages/app/public/client-metadata.json
```

Omit `-o` to print to stdout instead. The generated document looks like:

```json
{
  "client_id": "https://recipes.example.com/client-metadata.json",
  "client_name": "Pantry Host (self-hosted)",
  "client_uri": "https://recipes.example.com",
  "redirect_uris": ["https://recipes.example.com/oauth/bluesky/callback"],
  "scope": "atproto repo:exchange.recipe.recipe repo:exchange.recipe.collection blob:image/*",
  "token_endpoint_auth_method": "none",
  "application_type": "web",
  "dpop_bound_access_tokens": true
}
```

The `scope`, callback path, and grant/response types come from
`@pantry-host/shared/atproto-client` — the same source of truth the running app
uses to request the token, so your document can't drift from what the client
asks for.

### 2. Serve it over HTTPS

Files in `packages/app/public/` are served at the app root, so once the app is
built and running behind HTTPS the document is live at:

```
https://recipes.example.com/client-metadata.json
```

Confirm it before continuing:

```bash
curl -s https://recipes.example.com/client-metadata.json | head
```

The `client_id` inside must exactly equal the URL you fetched it from.

### 3. Point the app at it

Set the environment variable and restart:

```bash
# .env.local (Rex reads this via _document.tsx → <meta name="atproto-client-id">)
ATPROTO_CLIENT_ID=https://recipes.example.com/client-metadata.json
```

- **Rex app (Tier 2):** `_document.tsx` emits
  `<meta name="atproto-client-id" content="…">`. Rebuild + restart Rex so the
  meta tag is served (Rex doesn't inline `process.env` into the client bundle —
  same reason the dry-run flag rides a meta tag).
- **Vite web (Tier 1):** set `VITE_ATPROTO_CLIENT_ID` at build time instead.

Presence of this override does two things client-side:

1. `getProdClientId()` loads *your* metadata for OAuth.
2. `shouldUseBroker()` returns `false`, so sign-in runs directly against your
   origin instead of the pantryhost.app broker popup.

### 4. Turn off dry-run (if you haven't)

Publishing defaults to dry-run everywhere except `127.0.0.1`. To write real
records:

```bash
ATPROTO_PUBLISH_DRY_RUN=false
```

Rebuild + restart. Now Share to Bluesky signs in against your own instance and
writes to your PDS with no pantryhost.app involvement.

## Verifying

1. Open the instance at its public HTTPS origin.
2. On a recipe, click **Share to Bluesky**. The consent screen should show your
   `client_name` and redirect back to `https://recipes.example.com/oauth/bluesky/callback`
   — no `my.pantryhost.app` popup.
3. After confirming, the record lands in your repo. Check it:
   ```bash
   curl -s "https://<your-pds>/xrpc/com.atproto.repo.listRecords?repo=<your-did>&collection=exchange.recipe.recipe"
   ```

## Reverting to the broker

Unset `ATPROTO_CLIENT_ID` (and remove the generated `client-metadata.json` if
you like), rebuild, restart. Off-loopback origins fall back to the
`my.pantryhost.app` broker automatically.
