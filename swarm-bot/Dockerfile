FROM node:22-alpine AS builder
WORKDIR /app

# Copy root SDK first (needed as local dependency)
COPY package.json tsconfig.json tsup.config.ts ./
COPY src/ src/

# Install root deps and build SDK
RUN npm install --ignore-scripts && npm run build 2>/dev/null || true

# Copy swarm-bot
COPY swarm-bot/package.json swarm-bot/tsconfig.json swarm-bot/
COPY swarm-bot/src/ swarm-bot/src/

WORKDIR /app/swarm-bot
RUN npm install && npx tsc

# ── Production stage ──────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app

RUN apk add --no-cache tini
ENTRYPOINT ["/sbin/tini", "--"]

COPY --from=builder /app/swarm-bot/package.json ./
COPY --from=builder /app/swarm-bot/node_modules/ ./node_modules/
COPY --from=builder /app/swarm-bot/dist/ ./dist/
COPY --from=builder /app/swarm-bot/src/dashboard/ ./dist/dashboard/

RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3100
ENV DB_PATH=/app/data/swarm.db

EXPOSE 3100
VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
