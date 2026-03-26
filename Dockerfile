# Stage 1: Build
FROM node:22-trixie-slim AS build

RUN apt-get update && apt-get install -y libssl3t64 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY packages/app/package.json packages/app/
COPY packages/shared/package.json packages/shared/
COPY packages/marketing/package.json packages/marketing/
COPY packages/web/package.json packages/web/
COPY packages/mcp/package.json packages/mcp/
RUN npm ci

# Rex uses platform-specific native binaries — npm ci only installs for the
# lockfile's platform. Force-install the Linux binary for Docker builds.
RUN cd node_modules/@limlabs && npm pack @limlabs/rex-linux-arm64@0.20.0 && \
    tar -xzf limlabs-rex-linux-arm64-0.20.0.tgz && \
    mv package rex-linux-arm64 && \
    rm limlabs-rex-linux-arm64-0.20.0.tgz && \
    chmod +x rex-linux-arm64/bin/rex

# Copy source
COPY packages/app packages/app
COPY packages/shared packages/shared

# Rex needs React symlinked into packages/app/node_modules
RUN cd packages/app && mkdir -p node_modules && \
    ln -sf ../../../node_modules/react node_modules/react && \
    ln -sf ../../../node_modules/react-dom node_modules/react-dom

# Build Rex for production
RUN npx @limlabs/rex build --root packages/app

# Stage 2: Runtime
FROM node:22-trixie-slim

RUN apt-get update && apt-get install -y libssl3t64 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy built app from build stage
COPY --from=build /app /app

# Create uploads directory
RUN mkdir -p packages/app/public/uploads

COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

EXPOSE 3000 4001

ENTRYPOINT ["/docker-entrypoint.sh"]
