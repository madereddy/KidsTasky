# Stage 1: Build Environment
FROM node:20-alpine AS builder

ARG BUILD_VERSION=dev
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV VITE_BUILD_VERSION=$BUILD_VERSION

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++ gcc

# Enable pnpm
RUN corepack enable pnpm

# Copy dependency definitions
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Copy the entire project
COPY . .

# Build the Vite frontend application
RUN pnpm run build

# Prune devDependencies for runtime
RUN pnpm prune --prod

# Stage 2: Production Environment
FROM cgr.dev/chainguard/node:latest

WORKDIR /app

ARG BUILD_VERSION=dev
ARG BUILD_SHA=dev
ARG BUILD_TIME=unknown
ENV BUILD_VERSION=$BUILD_VERSION
ENV BUILD_SHA=$BUILD_SHA
ENV BUILD_TIME=$BUILD_TIME

# Copy package configurations
COPY --from=builder --chown=65532:65532 /app/package.json ./

# Copy production-only node_modules
COPY --from=builder --chown=65532:65532 /app/node_modules ./node_modules

# Copy the built assets (includes frontend dist/ and backend dist/server.js + migrations)
COPY --from=builder --chown=65532:65532 /app/dist ./dist

# Create data directory for SQLite and set permissions
USER root
RUN mkdir -p /data/uploads/photos && chown -R 65532:65532 /data
USER 65532:65532

# Expose the designated application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the Node.js application
CMD ["dist/server.js"]
