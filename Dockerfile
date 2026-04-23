# Stage 1: Build Environment
FROM node:20-alpine AS builder

# Install Python and build tools for native dependencies (like better-sqlite3)
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copy dependency definitions
COPY package*.json ./

# Install dependencies (including devDependencies for building)
RUN npm ci

# Copy the entire project
COPY . .

# Build the Vite frontend application
RUN npm run build

# Remove development dependencies to keep the image clean
RUN npm prune --production


# Stage 2: Production Environment
FROM node:20-alpine

# Provide minimum required shared libraries for native modules
RUN apk add --no-cache libstdc++

WORKDIR /app

# Copy package configurations
COPY --from=builder /app/package*.json ./

# Copy built node_modules (including native modules compiled in step 1)
COPY --from=builder /app/node_modules ./node_modules

# Copy the built Vite frontend assets
COPY --from=builder /app/dist ./dist

# Copy the backend server file
COPY --from=builder /app/server.ts ./

# Install tsx globally in the final stage to run server.ts
RUN npm install -g tsx

# Expose the designated application port
EXPOSE 3000

# Set environment to production
ENV NODE_ENV=production

# Start the Node.js application utilizing tsx
CMD ["tsx", "server.ts"]
