# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Create non-root user
RUN addgroup -S bot && adduser -S bot -G bot

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist dist/

# Persistent data directory for watch entries
RUN mkdir -p /app/data && chown bot:bot /app/data
VOLUME /app/data

USER bot

CMD ["node", "dist/index.js"]
