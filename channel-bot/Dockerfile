# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS build

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ src/
RUN npm run build

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:20-alpine

LABEL org.opencontainers.image.title="PumpFun Channel Feed Bot"
LABEL org.opencontainers.image.description="Read-only Telegram channel feed for PumpFun activity"

WORKDIR /app

RUN addgroup -S bot && adduser -S bot -G bot

COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=build /app/dist dist/

# Writable data directory for persisted claim tracker
RUN mkdir -p /app/data && chown bot:bot /app/data
ENV DATA_DIR=/app/data

USER bot

EXPOSE 3000

CMD ["node", "--enable-source-maps", "dist/index.js"]

