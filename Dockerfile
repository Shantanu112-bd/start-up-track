FROM node:20-alpine AS base
WORKDIR /app

# Copy root workspace config
COPY package*.json ./
COPY turbo.json ./

# Copy all workspace package.json files
COPY apps/api/package*.json ./apps/api/
COPY packages/sdk/package*.json ./packages/sdk/
COPY packages/types/package*.json ./packages/types/
COPY packages/ui/package*.json ./packages/ui/

# Install all dependencies
RUN npm ci

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages

# Generate Prisma client
RUN cd apps/api && npx prisma generate --schema=prisma/schema.prisma

# Build packages in order
RUN npx turbo run build --filter=@cryptopay/types
RUN npx turbo run build --filter=@cryptopay/sdk
RUN npx turbo run build --filter=@cryptopay/api

# Production image
FROM node:20-alpine AS production
WORKDIR /app

COPY package*.json ./
COPY turbo.json ./
COPY apps/api/package*.json ./apps/api/
COPY packages/sdk/package*.json ./packages/sdk/
COPY packages/types/package*.json ./packages/types/
COPY packages/ui/package*.json ./packages/ui/

RUN npm ci --omit=dev

COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/api/prisma ./apps/api/prisma
COPY --from=base /app/apps/api/src/generated ./apps/api/src/generated
COPY --from=base /app/packages/sdk/dist ./packages/sdk/dist
COPY --from=base /app/packages/types/dist ./packages/types/dist
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules

WORKDIR /app/apps/api

EXPOSE 10000
ENV PORT=10000
ENV NODE_ENV=production

CMD ["node", "dist/main.js"]
