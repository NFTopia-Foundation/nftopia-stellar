# ==========================================
# STAGE 1: Build the Application
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /usr/src/app

# Copy package files first to maximize Docker layer caching
COPY package*.json ./

# Install all dependencies (including devDependencies needed for building)
RUN npm ci

# Copy application source code
COPY . .

# Build the NestJS application production bundle
RUN npm run build

# ==========================================
# STAGE 2: Production Runtime
# ==========================================
FROM node:22-alpine AS production

WORKDIR /usr/src/app

# Set production environment flags
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}
ENV PORT=3000

# Copy package files and install ONLY production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy the compiled distribution from the builder stage
COPY --from=builder /usr/src/app/dist ./dist

# Expose ports for both the REST API (3000) and GraphQL Gateway (3001)
EXPOSE 3000
EXPOSE 3001

# Healthcheck configuration using wget (native to alpine) to poll the /health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Switch to non-root user for security compliance
USER node

# Start the application using the production build script
CMD ["npm", "run", "start:prod"]