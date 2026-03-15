# ==================== BUILD STAGE ====================
FROM node:20-slim AS builder

WORKDIR /app

# Install OpenSSL for Prisma
RUN apt-get update && apt-get install -y openssl libssl-dev && rm -rf /var/lib/apt/lists/*

# Copy only what's needed for npm install
COPY package*.json ./
COPY packages ./packages
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/
COPY backend/tsconfig*.json ./backend/
COPY backend/nest-cli.json ./backend/
COPY backend/src ./backend/src
COPY backend/assets ./backend/assets

WORKDIR /app/backend
RUN npm install

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build

# ==================== PRODUCTION STAGE ====================
FROM node:20-slim AS production

WORKDIR /app

# Install dumb-init + openssl + wget for healthcheck
RUN apt-get update && apt-get install -y --no-install-recommends dumb-init openssl wget && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -g 1001 nodejs && useradd -u 1001 -g nodejs -m nestjs

# Copy package files and install production deps only
COPY backend/package*.json ./
COPY backend/prisma ./prisma/
RUN npm install --omit=dev && npx prisma generate && npm cache clean --force

# Copy built application
COPY --from=builder /app/backend/dist ./dist

# Copy font assets for PDF generation (prescription PDFs with French accents)
COPY backend/assets ./assets

# Set ownership
RUN chown -R nestjs:nodejs /app

USER nestjs

EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD wget -qO- http://localhost:3001/api/v1/health || exit 1

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/src/main"]
