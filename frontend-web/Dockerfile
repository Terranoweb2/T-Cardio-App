# ==================== BUILD STAGE ====================
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy source code
COPY . .

# Set build-time env
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}

# Build Next.js
RUN npm run build

# ==================== PRODUCTION STAGE ====================
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache dumb-init

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# Copy built standalone output
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone/app ./
COPY --from=builder /app/.next/static ./.next/static

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

ENV NODE_ENV=production
ENV HOSTNAME="0.0.0.0"

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD node -e "const h=require('http');h.get('http://localhost:3000',(r)=>{process.exit(r.statusCode===200?0:1)}).on('error',()=>process.exit(1))"

ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "server.js"]
