# Integrations

PantryHost ships an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server with 28 tools exposing the full GraphQL API. Any MCP-compatible AI client can search your pantry, manage recipes, menus, build grocery lists, and more — right from your LAN.

## Supported Clients

### Local (stdio)

These clients connect via stdio transport. Point them at the MCP server and go.

| Client | Setup |
|--------|-------|
| [Claude Desktop](https://claude.ai/download) | Add to `claude_desktop_config.json` (see [config](#claude-desktop)) |
| [Claude Code](https://docs.anthropic.com/en/docs/claude-code) | `claude mcp add pantry-host npx tsx /path/to/packages/mcp/src/index.ts -- --stdio` |
| [ChatGPT Desktop](https://openai.com/chatgpt/desktop/) | Add MCP server in Settings → Tools |
| [Cursor](https://cursor.com) | Add to `.cursor/mcp.json` (see [config](#cursor)) |
| [VS Code + GitHub Copilot](https://code.visualstudio.com/docs/copilot/customization/mcp-servers) | Add to `.vscode/mcp.json` (see [config](#vs-code)) |
| [Windsurf](https://windsurf.com) | Add to MCP settings |
| [Cline](https://github.com/cline/cline) | Add via MCP server settings in VS Code |
| [Zed](https://zed.dev) | Built-in MCP support |
| [Continue.dev](https://continue.dev) | Add to Continue config |
| [Goose](https://github.com/block/goose) | Add to Goose extensions |

### Remote (HTTP)

These clients connect via Streamable HTTP on port 5001. Start the server with `--http`:

```bash
cd packages/mcp && npx tsx src/index.ts --http
# Listening on http://0.0.0.0:5001/mcp
```

Set `MCP_API_KEY` for bearer token auth on remote connections.

| Client | Notes |
|--------|-------|
| [OpenClaw](https://docs.openclaw.ai) | Self-hosted AI agent for WhatsApp, Telegram, Discord. Full MCP support. |
| [IronClaw](https://github.com/nearai/ironclaw) | Rust-based privacy-first agent. Auto-generates tools from MCP discovery. |
| [Home Assistant](https://www.home-assistant.io/integrations/mcp/) | Official MCP client since 2025.2. Query your pantry from smart home automations. |
| [Glama Chat](https://glama.ai) | Multi-modal AI client with MCP support. |

## Setup Examples

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "pantry-host": {
      "command": "npx",
      "args": ["tsx", "/path/to/pantry-host/packages/mcp/src/index.ts", "--stdio"],
      "env": {
        "GRAPHQL_URL": "http://localhost:4001/graphql"
      }
    }
  }
}
```

### Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "pantry-host": {
      "command": "npx",
      "args": ["tsx", "/path/to/pantry-host/packages/mcp/src/index.ts", "--stdio"],
      "env": {
        "GRAPHQL_URL": "http://localhost:4001/graphql"
      }
    }
  }
}
```

### VS Code

Add to `.vscode/mcp.json`:

```json
{
  "servers": {
    "pantry-host": {
      "command": "npx",
      "args": ["tsx", "/path/to/pantry-host/packages/mcp/src/index.ts", "--stdio"],
      "env": {
        "GRAPHQL_URL": "http://localhost:4001/graphql"
      }
    }
  }
}
```

### OpenClaw (WhatsApp, Telegram, Discord)

[OpenClaw](https://openclaw.ai) is a self-hosted AI agent gateway that connects AI models to messaging platforms. With the MCP plugin, your household can text your pantry from WhatsApp, Telegram, Discord, Slack, Signal, or iMessage.

```
User (WhatsApp) → OpenClaw → MCP plugin → Pantry Host (:5001) → GraphQL → Postgres
```

**Example conversations:**
- "How many eggs do we have?" → `search_pantry` → "You have 12 eggs"
- "What can I make for dinner?" → `generate_recipes` → 3 AI-suggested recipes
- "Queue the chicken marsala" → `queue_recipe` → "Chicken Marsala queued"
- "Add milk to the list" → `add_ingredient` → "Added milk to your pantry"

**Prerequisites:**
- Pantry Host running with the MCP server in HTTP mode (port 5001)
- [OpenClaw installed](https://openclaw.ai) with a messaging channel connected

**Step 1:** Install the MCP plugin:

```bash
openclaw plugin install openclaw-mcp-plugin
```

**Step 2:** Add Pantry Host to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "entries": {
      "mcp-integration": {
        "enabled": true,
        "config": {
          "servers": {
            "pantry-host": {
              "enabled": true,
              "transport": "http",
              "url": "http://localhost:5001/mcp"
            }
          }
        }
      }
    }
  }
}
```

If Pantry Host is on a different machine (Pi, Mac Mini, etc.), use its LAN IP:

```json
"url": "http://192.168.1.X:5001/mcp"
```

With bearer auth:

```json
"url": "http://192.168.1.X:5001/mcp",
"headers": { "Authorization": "Bearer your-mcp-api-key" }
```

**Step 3:** Start the MCP server in HTTP mode:

```bash
MCP_API_KEY=your-secret npx tsx packages/mcp/src/index.ts --http
```

Or with Docker (port 5001 is exposed when `ENABLE_MCP=true`).

**Step 4:** Send a message from your connected messaging app. OpenClaw discovers Pantry Host's 28 tools automatically via MCP and routes your natural language queries to the right tool.

### IronClaw (Telegram, Slack, CLI)

[IronClaw](https://github.com/nearai/ironclaw) is a Rust-based, privacy-first AI agent with built-in messaging channels (Telegram, Slack, Signal, CLI). It connects to Pantry Host via MCP HTTP and auto-discovers all 28 tools — your household can text the pantry from Telegram.

```
User (Telegram) → IronClaw → MCP HTTP (:5001) → GraphQL (:4001) → Postgres
```

**Example conversations:**
- "What's in my pantry?" → `search_pantry` → categorized inventory with counts
- "When was dark chocolate added?" → `search_pantry` → "Added on March 30, 2026"
- "Queue the chicken marsala" → `queue_recipe` → "Chicken Marsala queued"
- "What can I make for dinner?" → `search_recipes` → recipe suggestions based on pantry

**Prerequisites:**
- Pantry Host GraphQL server running on port 4001
- Pantry Host MCP server running in HTTP mode on port 5001 (with `MCP_API_KEY` set)
- An Anthropic API key (for the LLM powering IronClaw's responses)

**Step 1:** Install IronClaw:

```bash
brew install ironclaw
```

**Step 2:** Run first-time onboarding (sets up libSQL database and secrets):

```bash
ironclaw onboard --quick
```

**Step 3:** Add Pantry Host as an MCP server:

```bash
ironclaw mcp add pantry-host http://localhost:5001/mcp \
  --header 'Authorization:Bearer YOUR_MCP_API_KEY' \
  --description 'PantryHost kitchen manager'
```

Verify the connection (should list all 28 tools):

```bash
ironclaw mcp test pantry-host
```

**Step 4:** Configure the LLM provider. IronClaw defaults to its own LLM gateway — switch to Anthropic with your own API key:

```bash
ironclaw models set-provider anthropic --model claude-haiku-4-5-20251001
```

Add your API key to `~/.ironclaw/.env`:

```
ANTHROPIC_API_KEY=sk-ant-...
```

> **Tip:** Haiku is recommended for pantry queries — fast, cheap, and more than capable for tool-calling. Sonnet/Opus work too but consume significantly more tokens (28 tool definitions are sent with every message).

**Step 5:** Add the Telegram channel:

```bash
ironclaw registry install telegram
```

Create a bot via [@BotFather](https://t.me/BotFather) on Telegram (`/newbot`), then add the token to `~/.ironclaw/.env`:

```
TELEGRAM_BOT_TOKEN=123456789:AABBccDDeeFFgg...
```

Enable polling in the channel config (`~/.ironclaw/channels/telegram.capabilities.json`):

```json
{
  "config": {
    "polling_enabled": true,
    "dm_policy": "open"
  }
}
```

> Polling mode means no public URL is needed — IronClaw reaches out to Telegram, not the other way around. All data stays on your LAN.

**Step 6:** Start IronClaw and test:

```bash
ironclaw run
```

Send a message to your Telegram bot — it should respond using Pantry Host tools.

For production, manage IronClaw as a brew service:

```bash
brew services start ironclaw
brew services restart ironclaw
ironclaw status          # check system status
ironclaw logs            # view logs
```

**Known issues (v0.23.0):**
- **Slack:** The WASM channel registers a webhook endpoint but returns 404. Slack's `url_verification` challenge fails. Telegram (polling) works. Revisit Slack after IronClaw updates.
- **Gateway port:** IronClaw's default gateway port is 3000, which conflicts with Pantry Host's Rex server. Change it: `ironclaw config set channels.gateway_port 3001`
- **SECRETS_MASTER_KEY:** If `ironclaw mcp test` fails with "SECRETS_MASTER_KEY not set", generate one: `echo "SECRETS_MASTER_KEY=\"$(openssl rand -hex 32)\"" >> ~/.ironclaw/.env`

## Available Tools

**Read (9):** `search_pantry`, `search_recipes`, `get_recipe`, `list_cookware`, `get_cookware`, `list_kitchens`, `get_kitchen`, `list_menus`, `get_menu`

**Write (14):** `add_ingredient`, `add_ingredients`, `update_ingredient`, `remove_ingredient`, `create_recipe`, `update_recipe`, `delete_recipe`, `mark_recipe_cooked`, `queue_recipe`, `add_cookware`, `update_cookware`, `delete_cookware`, `create_menu`, `update_menu`, `delete_menu`

**AI (1):** `generate_recipes` — requires `AI_API_KEY` on the GraphQL server

**Resources:** `pantry://ingredients`, `pantry://recipes`, `pantry://cookware`, `pantry://menus`, `pantry://kitchens`

## GraphQL API

For non-MCP integrators, the GraphQL API is available directly at `http://localhost:4001/graphql`. See `packages/app/lib/schema/index.ts` for the full schema.

### Siri Shortcut (iOS, hands-free with voice response)

With IronClaw running, you can ask Siri about your pantry and hear the answer spoken back. This requires a small relay server that bridges iOS Shortcuts to IronClaw's gateway API.

```
"Hey Siri, Pantry" → dictate
  → iOS Shortcut → Relay (:3004) → IronClaw gateway (:3001)
    → Claude Haiku → MCP (:5001) → GraphQL (:4001) → Postgres
      → response → Siri speaks it
```

**Step 1:** Deploy the relay server. Copy `telegram-relay.ts` to your Pantry Host machine and run it:

```bash
# Set environment
export GATEWAY_URL=http://localhost:3001
export GATEWAY_TOKEN=<your-ironclaw-gateway-auth-token>
export RELAY_PORT=3004

# Start with pm2
pm2 start start-telegram-relay.sh --name telegram-relay
```

The relay POSTs your message to IronClaw's `/api/chat/send` endpoint, polls `/api/chat/history` for the completed response, and returns it synchronously as JSON.

Find your gateway token in IronClaw's config: `ironclaw config list | grep gateway_auth_token`

**Step 2:** Expose the relay on your tailnet (or LAN):

```bash
tailscale serve --bg --https=3004 http://localhost:3004
```

> **Important:** Start the relay process *before* adding the Tailscale serve, as Tailscale serve binds the target port.

**Step 3:** Create an iOS Shortcut with 5 actions:

1. **Ask for Input** — Type: Text, Prompt: "What do you want to tell your pantry?"
2. **URL** — `https://<your-tailscale-hostname>:3004`
3. **Get Contents of URL** — URL: from step 2, Method: POST, Body: JSON, field `text` = Ask Each Time
4. **Get Dictionary Value** — Key: `response`, from: Contents of URL
5. **Speak Text** — input: Dictionary Value

Name the shortcut **"Pantry"** and trigger it with **"Hey Siri, Pantry"**.

**Example queries:**
- "How many eggs do I have?" → "44 eggs."
- "What dairy do we have?" → categorized list of dairy items
- "Add 2 lbs chicken thighs" → adds to pantry
- "Queue the chicken marsala" → queues the recipe

**Bonus:** Create single-purpose shortcuts with hardcoded text (skip the Ask for Input step):

| Shortcut name | Hardcoded `text` |
|---------------|-----------------|
| "Pantry status" | `"what's running low?"` |
| "What's for dinner" | `"what can I make for dinner?"` |
| "Grocery check" | `"what's on the grocery list?"` |

## Community Integration Ideas

We keep the MCP server solid — the community builds the bridges. Here are opportunities:

| Platform | Idea |
|----------|------|
| **OpenClaw Skills** | "Ask your pantry" via WhatsApp or Telegram |
| **IronClaw WASM Tools** | Auto-generated tools from MCP server discovery |
| **Home Assistant** | "Add milk to the grocery list" via voice assistant |
| **Raycast** | Quick pantry lookup from macOS launcher |
| **n8n / Make** | Workflow automation (scan receipt → add ingredients) |
| **Shortcuts (iOS/macOS)** | Siri → HTTP → PantryHost MCP |

Built something? Open a PR to add it here.
