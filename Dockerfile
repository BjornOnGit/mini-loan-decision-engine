# Stage 1: Build the application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package.json and pnpm-lock.yaml to leverage Docker cache
COPY package.json pnpm-lock.yaml ./

# Install dependencies using pnpm
RUN npm install -g pnpm && pnpm install

# Copy the rest of the application source code (including prisma/schema.prisma)
COPY . .

# Generate Prisma client
RUN pnpm run db:generate

# Build the TypeScript application
RUN pnpm run build

# Stage 2: Run the application
FROM node:20-alpine

WORKDIR /app

# Install pnpm globally in the final stage so 'pnpm start' works
RUN npm install -g pnpm

# Install OpenSSL runtime dependency for Prisma
RUN apk add --no-cache openssl

# Copy only necessary files from the builder stage
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package.json ./package.json
COPY swagger.yaml ./swagger.yaml

# Expose the port the app runs on
EXPOSE 3000

# Set environment variables for production
ENV NODE_ENV=production
ENV PORT=3000

# Command to run the application using pnpm
CMD ["pnpm", "start"]
