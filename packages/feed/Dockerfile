FROM node:20-slim

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY src/ src/
COPY tsconfig.json ./

# Create data directory for SQLite
RUN mkdir -p /data

CMD ["npx", "tsx", "src/server.ts"]
