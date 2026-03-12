# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

# Native deps for better-sqlite3 and canvas
RUN apk add --no-cache python3 make g++ cairo-dev pango-dev jpeg-dev giflib-dev librsvg-dev

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine

LABEL org.opencontainers.image.title="PumpKit Tracker Bot"
LABEL org.opencontainers.image.description="Telegram call-tracking bot with leaderboards and PNL cards"

# Runtime deps for canvas and better-sqlite3
RUN apk add --no-cache cairo pango jpeg giflib librsvg

WORKDIR /app

RUN addgroup -S bot && adduser -S bot -G bot

COPY package.json ./
RUN apk add --no-cache python3 make g++ && \
    npm install --omit=dev && \
    npm cache clean --force && \
    apk del python3 make g++

COPY --from=build /app/dist dist/

# Writable data directory for SQLite database
RUN mkdir -p /app/data && chown bot:bot /app/data
ENV DATA_DIR=/app/data

USER bot

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-3000}/health || exit 0

CMD ["node", "--enable-source-maps", "dist/index.js"]
