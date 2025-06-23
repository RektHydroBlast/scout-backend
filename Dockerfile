FROM node:18-alpine

WORKDIR /app

# Install system dependencies for AI packages and health check
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    git \
    curl \
    ca-certificates

# Use corepack for pnpm
RUN corepack enable
RUN corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json ./
COPY pnpm-lock.yaml ./

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source code AFTER installing dependencies
COPY . .

# Now build the application
RUN pnpm build

# Create non-root user for security
RUN addgroup -g 1001 -S nodejs
RUN adduser -S nodejs -u 1001

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app
USER nodejs

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3001/health || exit 1

# Start the application
CMD ["pnpm", "start"]
