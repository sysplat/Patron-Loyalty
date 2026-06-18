# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS base
RUN apk add --no-cache python3 make g++
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS builder
WORKDIR /app

COPY package.json pnpm-lock.yaml tsconfig.base.json ./
COPY railway/docker/pnpm-workspace.notifications.yaml pnpm-workspace.yaml
COPY packages/notifications/package.json packages/notifications/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --filter "@queueplatform/notifications..."

COPY packages/notifications packages/notifications
COPY packages/database packages/database
COPY packages/shared packages/shared

RUN pnpm --filter @queueplatform/database build
RUN pnpm --filter @queueplatform/shared build
RUN pnpm --filter @queueplatform/notifications build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

COPY package.json pnpm-lock.yaml tsconfig.base.json ./
COPY railway/docker/pnpm-workspace.notifications.yaml pnpm-workspace.yaml
COPY packages/notifications/package.json packages/notifications/
COPY packages/database/package.json packages/database/
COPY packages/shared/package.json packages/shared/
COPY packages/database/prisma packages/database/prisma

RUN pnpm install --frozen-lockfile --prod --ignore-scripts --filter "@queueplatform/notifications..."

COPY --from=builder /app/packages/notifications/dist packages/notifications/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/database/dist packages/database/dist

RUN pnpm --filter @queueplatform/database db:generate

CMD ["node", "packages/notifications/dist/index.js"]
