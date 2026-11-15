FROM node:22-alpine AS base

# Install libc compatibility layer and openssl for Alpine + Prisma
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app

# Stage 1: Install dependencies
FROM base AS deps
WORKDIR /app
COPY package*.json ./
COPY prisma ./prisma/
COPY prisma.config.ts ./
RUN npm ci

# Stage 2: Build the Next.js standalone application
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build-time environment variables for Next.js compilation
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production
ARG NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV NEXT_PUBLIC_GOOGLE_CLIENT_ID=$NEXT_PUBLIC_GOOGLE_CLIENT_ID
ENV DATABASE_URL="postgresql://postgres:postgres@localhost:5432/facesearch"
ENV DIRECT_URL="postgresql://postgres:postgres@localhost:5432/facesearch"
ENV JWT_SECRET="build-placeholder-jwt-secret-not-for-production"

RUN npx prisma generate
# Next 16 defaults to Turbopack, whose font import mapper currently fails on
# this app's multi-weight Google fonts. Use the stable production Webpack path.
RUN npx next build --webpack

# Stage 3: Production runner
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Prerender cache folder
RUN mkdir .next && chown nextjs:nodejs .next

# Copy static assets and standalone build
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/prisma.config.ts ./prisma.config.ts

# Copy Prisma CLI and schema engine for Kubernetes migration initContainer
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

# The migration initContainer invokes the Prisma binary directly. npm/npx are
# not needed at runtime, so omit their bundled dependency tree from the image.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/bin/npm /usr/local/bin/npx

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
