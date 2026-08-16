# Build stage
FROM node:22-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies without triggering postinstall (nuxt prepare)
# postinstall runs too early before source files are present
RUN npm ci --ignore-scripts

# Copy all source files
COPY . .

# Explicitly set Nitro preset and run prepare + build
ENV NITRO_PRESET=node-server
RUN npm run build

# Production stage
FROM node:22-alpine

WORKDIR /app

# Copy the build output from the build stage
COPY --from=build /app/.output ./.output

# Nuxt runs on port 3000
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Start the application using Nitro
CMD ["node", ".output/server/index.mjs"]
