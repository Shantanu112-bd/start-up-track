FROM node:20-alpine

WORKDIR /app

# Copy root package.json and lockfile
COPY package*.json ./

# Copy the entire monorepo
COPY . .

# Install dependencies (workspaces handled automatically by npm 7+)
RUN npm install

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# Build the API
RUN npm run build --workspace=apps/api

EXPOSE 4000
CMD ["npm", "run", "start:prod", "--workspace=apps/api"]
