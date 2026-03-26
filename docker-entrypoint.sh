#!/bin/sh
set -e

cd /app/packages/app

# Start GraphQL server (runs migrations on startup)
npx tsx graphql-server.ts &

# Start Rex prod server
npx @limlabs/rex start --host 0.0.0.0
