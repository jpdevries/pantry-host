#!/bin/sh
set -e

cd /app/packages/app

# Start GraphQL server (runs migrations on startup)
npx tsx graphql-server.ts &

# Start MCP server in HTTP mode (for OpenClaw, IronClaw, etc.)
if [ "$ENABLE_MCP" = "true" ] || [ -n "$MCP_API_KEY" ]; then
  cd /app/packages/mcp
  npx tsx src/index.ts --http &
  cd /app/packages/app
fi

# Start Rex prod server
npx @limlabs/rex start --host 0.0.0.0
