# Stage 1: Build Environment
FROM cgr.dev/chainguard/node:latest-dev AS builder

WORKDIR /app

# Copy dependency definitions
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Install dependencies (including devDependencies for building)
RUN pnpm install --frozen-lockfile

# Copy the entire project
COPY . .

# Build the Vite frontend application
RUN pnpm run build

# Stage 2: Production Environment
FROM cgr.dev/chainguard/node:latest

WORKDIR /app

# Copy package configurations
COPY --from=builder /app/package.json ./

# Copy built node_modules (including native modules compiled in step 1)
COPY --from=builder /app/node_modules ./node_modules

# Copy the built assets (includes frontend dist/ and backend dist/server.js + migrations)
COPY --from=builder /app/dist ./dist

# Create data directory for SQLite and set permissions
USER root
RUN mkdir -p /data && chown -R 65532:65532 /data /app
USER 65532:65532

# Expose the designated application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the Node.js application
CMD ["dist/server.js"]
