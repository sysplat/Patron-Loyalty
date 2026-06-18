# syntax=docker/dockerfile:1.6
# API-only image: do not install Next.js apps (avoids huge @next/swc-* binaries and builder disk exhaustion).
FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml tsconfig.base.json ./
COPY railway/docker/pnpm-workspace.api.yaml pnpm-workspace.yaml
COPY packages/api/package.json packages/api/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --filter "@queueplatform/api..."

COPY packages/api packages/api
COPY packages/database packages/database
COPY packages/shared packages/shared

RUN pnpm --filter @queueplatform/database build
RUN pnpm --filter @queueplatform/shared build
RUN pnpm --filter @queueplatform/api build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml tsconfig.base.json ./
COPY railway/docker/pnpm-workspace.api.yaml pnpm-workspace.yaml
COPY packages/api/package.json packages/api/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/database/prisma packages/database/prisma
COPY packages/database/scripts packages/database/scripts

RUN pnpm install --frozen-lockfile --prod --filter "@queueplatform/api..."

COPY --from=builder /app/packages/api/dist packages/api/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/database/dist packages/database/dist

RUN pnpm --filter @queueplatform/database db:generate

EXPOSE 4000

COPY scripts/railway-api-start.sh scripts/railway-api-start.sh
RUN chmod +x scripts/railway-api-start.sh
CMD ["sh", "scripts/railway-api-start.sh"]
