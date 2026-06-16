# ── Stage 1: builder ──────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

# Copy manifests first for layer-cached dependency install
COPY package*.json ./
RUN npm ci --include=dev

COPY . .
RUN npm run build

# Prune dev dependencies so only production deps land in the final image
RUN npm prune --omit=dev

# ── Stage 2: production ───────────────────────────────────────────────────────
FROM node:22-slim AS production

# Security: run as non-root
RUN groupadd --gid 1001 nftopia && \
    useradd  --uid 1001 --gid nftopia --shell /bin/bash --create-home nftopia

WORKDIR /app

# Copy built artifacts and pruned node_modules from builder
COPY --from=builder --chown=nftopia:nftopia /app/dist       ./dist
COPY --from=builder --chown=nftopia:nftopia /app/node_modules ./node_modules
COPY --from=builder --chown=nftopia:nftopia /app/package.json ./package.json

USER nftopia

# REST API
EXPOSE 3000
# GraphQL endpoint (optional secondary port)
EXPOSE 3001

ENV NODE_ENV=production

# Healthcheck wired to the /health endpoint already present in the app
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
  CMD node -e "require('http').get('http://localhost:'+process.env.PORT || 3000+'/health', r => process.exit(r.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"

CMD ["node", "dist/main"]
