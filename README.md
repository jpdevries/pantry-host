# Pantry Host

> There's already enough of your data in the cloud. Keep your recipes and pantry closer to home — running on your own hardware, on your own network, never stored in the cloud.

<sub><em>\*The optional AI&ndash;powered recipe creation feature sends your ingredient list to your configured AI provider ([Anthropic](https://docs.anthropic.com/en/docs/about-claude/models) or [OpenClaw](https://openclaw.com/)) to generate suggestions. Everything else stays entirely on your local machine.</em></sub>

A self-hosted Progressive Web&nbsp;App for managing your kitchen. Track your pantry and cookware, import recipes from URLs, generate AI-suggested meals from what you already have, and take your grocery list, fully informed by a recipe queue, to the store — even offline.

Built with Rex (React + rolldown), GraphQL (Pothos + graphql-yoga), PostgreSQL, and Tailwind CSS. Runs great on a Mac Mini, or whatever.

Want to access the API away from home? You can't. Unless you set up a [Tailscale](https://tailscale.com/) mesh network, an SSH tunnel (`ssh -L 3000:localhost:3000 your-mac`), or a reverse proxy like [Cloudflare Tunnel](https://developers.cloudflare.com/cloudflare-tunnel/) — but that's on you. By default, the app is only reachable on your local network, and that's the point.

---

## Features

- **Pantry** — track ingredients by category with quantities and tags; batch-scan groceries with your camera
- **Recipes** — add recipes manually or import from a URL; AI-generate recipes from your pantry
- **Grocery list** — queue recipes to cook; see what ingredients you're missing
- **Cookware** — track what equipment you have so AI suggestions stay realistic
- **Multiple kitchens** — separate pantries and recipes for different households (e.g. a guest kitchen, a relative's)

---

## Requirements

- Node.js 18+
- PostgreSQL 14+
- An AI API key (only required for AI recipe generation) — supports [Anthropic](https://console.anthropic.com/) and [OpenClaw](https://openclaw.com/)

---

## Development

```bash
# Install dependencies
npm install

# Copy and fill in environment variables
cp .env.example .env.local

# Start the dev server (Rex + GraphQL server together)
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

The GraphQL API runs on port 4001. The database schema is applied automatically on startup — no separate migration step needed.

---

## Local Hosting

Pantry Host is designed to run on a always-on home machine (a Mac Mini works well) and be accessed by devices on your local network via IP address. No cloud account, no subscription, no data leaving your home.

### 1. Set up PostgreSQL

Install PostgreSQL if you haven't already:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb pantry_host
```

### 2. Configure environment

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```
DATABASE_URL=postgres://your-mac-username@localhost:5432/pantry_host
AI_PROVIDER=anthropic
AI_API_KEY=sk-ant-...
```

`AI_PROVIDER` and `AI_API_KEY` are only needed for AI recipe generation. Everything else works without them. Supported providers: `anthropic`, `openclaw`.

### 3. Run as a persistent service with pm2

[pm2](https://pm2.keymetrics.io/) keeps the app running and restarts it automatically after reboots.

```bash
npm install -g pm2

# Start the app
pm2 start "npm run start" --name pantry-host

# Save so it restarts after reboot
pm2 save
pm2 startup
```

Follow the command `pm2 startup` prints to enable it as a launch agent.

### 4. Access from other devices on your network

Find your Mac's local IP address:

```bash
ipconfig getifaddr en0
```

Then open `http://192.168.x.x:3000` on any device connected to your home Wi-Fi — phones, tablets, other laptops. This gives full read/write access to all features except camera-based barcode scanning (which requires HTTPS on iOS).

**Tip:** For a friendlier local address, your Mac's hostname (e.g. `http://mac-mini.local:3000`) works automatically on most home networks via Bonjour.

### 5. HTTPS for camera features (optional)

iOS Safari requires HTTPS to access the camera. If you want to use the barcode scanner from your phone, set up a local HTTPS proxy with [mkcert](https://github.com/FiloSottile/mkcert):

```bash
# Install mkcert and create a local CA
brew install mkcert
mkcert -install

# Generate a cert for localhost and your Mac's IP
mkcert localhost 127.0.0.1 192.168.x.x

# Install the HTTPS proxy
npm install -g local-ssl-proxy

# Run proxies for both the frontend and GraphQL server
local-ssl-proxy --source 3443 --target 3000 --cert ./localhost+2.pem --key ./localhost+2-key.pem &
local-ssl-proxy --source 4443 --target 4001 --cert ./localhost+2.pem --key ./localhost+2-key.pem &
```

A convenience script is included at `scripts/https-proxy.sh`.

Then open `https://192.168.x.x:3443` on your phone.

#### Trusting the certificate on iOS

iOS requires the mkcert root CA to be installed as a profile **and** explicitly trusted. Use Safari for all of these steps — Chrome on iOS cannot install profiles or trust certificates.

**1. Serve the root CA from your Mac:**

```bash
cp "$(mkcert -CAROOT)/rootCA.pem" /tmp/rootCA.pem
cd /tmp && python3 -m http.server 8888
```

**2. Install the profile on your iPhone:**

Open Safari and go to `http://192.168.x.x:8888/rootCA.pem`. iOS will prompt you to download a configuration profile — tap **Allow**.

**3. Install the profile:**

Go to **Settings → General → VPN & Device Management** (or **Profiles & Device Management** on older iOS). Tap the mkcert profile and tap **Install**.

**4. Enable full trust:**

Go to **Settings → General → About → Certificate Trust Settings**. Toggle on full trust for the mkcert root certificate. This is a separate step from installing the profile — both are required.

**5. Verify both ports:**

Visit `https://192.168.x.x:3443` (frontend) and `https://192.168.x.x:4443` (API) in Safari. Both should load without certificate warnings. Once trusted, Chrome on iOS will also work.

> **If your Mac's IP address changes** (e.g. switching WiFi networks), regenerate the cert: `mkcert localhost 127.0.0.1 <new-ip>`, then restart both proxies with the new cert files. You do not need to reinstall the root CA on iOS — only the server cert changes.

**Guest mode:** When someone connects over HTTP via IP address, the UI automatically hides owner-facing features like Batch Scan and Cookware — they see a streamlined read/write view of the pantry, list, and recipes. On `localhost` (dev) or HTTPS, all features are visible.

### 6. Remote access (optional)

If you want to reach the app while away from home without exposing it to the public internet, [Tailscale](https://tailscale.com/) is the easiest option. Install it on your Mac Mini and any device you want access from — it creates a private WireGuard network between them.

### Backups

The app's data lives entirely in PostgreSQL. A simple daily dump is enough:

```bash
# Add to crontab: crontab -e
0 2 * * * pg_dump pantry_host > ~/backups/pantry_host_$(date +\%Y\%m\%d).sql
```

Store those dumps on a Time Machine volume or external drive and you're covered.

---

## Power User

For developers and AI-first workflows, Pantry Host can be set up and managed entirely through a coding agent.

### Claude Code

Clone the repo, open it in [Claude Code](https://claude.ai/code), and let it handle the rest. Claude reads `CLAUDE.md` for full project context — it knows the schema, the GraphQL API, the monorepo layout, and how to run everything.

```bash
git clone https://github.com/jpdevries/pantry-host.git
cd pantry-host
claude
```

From there you can import recipes from URLs, generate new ones from your pantry, manage ingredients, and build features conversationally.

### Claude in Chrome

No server? No problem. Open [my.pantryhost.app](https://my.pantryhost.app) in Chrome with the [Claude in Chrome](https://chromewebstore.google.com/detail/claude/danfokkoeegljpdgjhoelpmjibkjkfmm) extension and Claude becomes the backend. It can read your pantry, fetch recipe URLs, parse ingredients, and fill in forms — all without a server.

**Example prompts:**

```
Import this recipe: https://www.seriouseats.com/the-best-slow-cooked-bolognese-sauce-recipe
```

```
What can I make with what's in my pantry?
```

```
Add 2 lbs chicken thighs, 1 bunch cilantro, and a lime to my pantry
```

```
Build me a weekly dinner menu using only what I have on hand
```

```
I have guests coming who are gluten-free. Which of my recipes work?
```

### OpenClaw

[OpenClaw](https://openclaw.com/) is an alternative AI provider you can use in place of Anthropic. Set `AI_PROVIDER=openclaw` and your OpenClaw API key in `.env.local`:

```
AI_PROVIDER=openclaw
AI_API_KEY=your-openclaw-key
```

The self-hosted app will route AI recipe generation through OpenClaw instead of Anthropic. Everything else — the pantry, recipes, grocery list, offline support — works the same regardless of provider.

---

## Environment Variables

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `AI_PROVIDER` | No | AI provider for recipe generation (`anthropic` or `openclaw`, default: `anthropic`) |
| `AI_API_KEY` | No | API key for the configured AI provider |
| `GRAPHQL_PORT` | No | GraphQL server port (default: `4001`) |
