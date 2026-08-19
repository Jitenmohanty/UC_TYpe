FROM node:20-alpine AS base
WORKDIR /app
COPY package*.json ./

FROM base AS deps
RUN npm ci

FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

# Create non-root user
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 appuser
USER appuser

EXPOSE 3000

# Default: API server (override in docker-compose for worker)
CMD ["node", "dist/server.js"]

FROM base AS test
ENV NODE_ENV=test
COPY --from=deps /app/node_modules ./node_modules
COPY . .
CMD ["npm", "run", "test:integration"]

