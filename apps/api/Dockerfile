FROM node:20-alpine

WORKDIR /app

# Copy root package.json and lockfile
COPY package*.json ./

# Copy the entire monorepo
COPY . .

# Install dependencies (workspaces handled automatically by npm 7+)
# --include=dev ensures Prisma and TypeScript are installed even if Railway sets NODE_ENV=production
RUN npm install --include=dev

# Make DATABASE_URL available at build time (prisma generate needs it to load config,
# but does not actually connect to the database — a placeholder is sufficient)
ARG DATABASE_URL=postgresql://placeholder:placeholder@localhost:5432/placeholder

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build the API
RUN npm run build --workspace=apps/api

EXPOSE 4000
CMD ["npm", "run", "start:prod", "--workspace=apps/api"]
