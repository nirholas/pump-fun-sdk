# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY mcp-server/package.json mcp-server/package-lock.json* ./
RUN npm ci

COPY mcp-server/tsconfig.json ./
COPY mcp-server/src/ src/
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

RUN addgroup -S mcp && adduser -S mcp -G mcp

COPY mcp-server/package.json mcp-server/package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist dist/

USER mcp

EXPOSE 3000

CMD ["node", "dist/http-server.js"]
