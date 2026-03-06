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

LABEL org.opencontainers.image.title="PumpFun Fee Monitor"
LABEL org.opencontainers.image.description="Telegram bot + REST API for PumpFun fee claim monitoring"

WORKDIR /app

# Create non-root user
RUN addgroup -S bot && adduser -S bot -G bot

COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist dist/

# Persistent data directory for watch entries
# NOTE: Railway bans the VOLUME keyword — use Railway Volumes instead
# https://docs.railway.com/reference/volumes
RUN mkdir -p /app/data && chown bot:bot /app/data

# API server port — Railway injects PORT; EXPOSE is just metadata
EXPOSE 3000

USER bot

# Health check against the API (noop when API disabled)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/api/v1/health || exit 0

CMD ["node", "dist/index.js"]
