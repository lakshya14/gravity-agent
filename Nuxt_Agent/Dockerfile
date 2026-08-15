# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy all source files
COPY . .

# Build the Nuxt application
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy the build output from the build stage
COPY --from=build /app/.output ./.output

# Nuxt typically runs on port 3000
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Start the application using Nitro (Nuxt 4 server)
CMD ["node", ".output/server/index.mjs"]
