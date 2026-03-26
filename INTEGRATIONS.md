# Integrations

PantryHost ships an [MCP (Model Context Protocol)](https://modelcontextprotocol.io/) server with 28 tools exposing the full GraphQL API. Any MCP-compatible AI client can search your pantry, manage recipes, build grocery lists, and more — right from your LAN.

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
      "args": ["tsx", "/path/to/pantry-list/packages/mcp/src/index.ts", "--stdio"],
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
      "args": ["tsx", "/path/to/pantry-list/packages/mcp/src/index.ts", "--stdio"],
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
      "args": ["tsx", "/path/to/pantry-list/packages/mcp/src/index.ts", "--stdio"],
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

### IronClaw (HTTP)

Point [IronClaw](https://github.com/nearai/ironclaw) at your Pantry Host MCP endpoint:

```
MCP_URL=http://<your-lan-ip>:5001/mcp
```

If `MCP_API_KEY` is set on the server, include the bearer token in requests.

## Available Tools

**Read (9):** `search_pantry`, `search_recipes`, `get_recipe`, `list_cookware`, `get_cookware`, `list_kitchens`, `get_kitchen`, `list_menus`, `get_menu`

**Write (14):** `add_ingredient`, `add_ingredients`, `update_ingredient`, `remove_ingredient`, `create_recipe`, `update_recipe`, `delete_recipe`, `mark_recipe_cooked`, `queue_recipe`, `add_cookware`, `update_cookware`, `delete_cookware`, `create_menu`, `update_menu`, `delete_menu`

**AI (1):** `generate_recipes` — requires `AI_API_KEY` on the GraphQL server

**Resources:** `pantry://ingredients`, `pantry://recipes`, `pantry://cookware`, `pantry://menus`, `pantry://kitchens`

## GraphQL API

For non-MCP integrators, the GraphQL API is available directly at `http://localhost:4001/graphql`. See `packages/app/lib/schema/index.ts` for the full schema.

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
