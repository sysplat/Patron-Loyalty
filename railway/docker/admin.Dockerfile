# syntax=docker/dockerfile:1.6
FROM node:22-alpine AS base
RUN apk add --no-cache libc6-compat
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

FROM base AS builder
WORKDIR /app

ARG NEXT_PUBLIC_API_URL=http://localhost:4000/api/v1
ARG NEXT_PUBLIC_CENTRIFUGO_WS_URL=ws://localhost:8000/connection/websocket
ARG NEXT_PUBLIC_WEB_URL=http://localhost:3000
ARG NEXT_PUBLIC_LOYALTY_URL=http://localhost:3003
ARG NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
ENV NEXT_PUBLIC_CENTRIFUGO_WS_URL=${NEXT_PUBLIC_CENTRIFUGO_WS_URL}
ENV NEXT_PUBLIC_WEB_URL=${NEXT_PUBLIC_WEB_URL}
ENV NEXT_PUBLIC_LOYALTY_URL=${NEXT_PUBLIC_LOYALTY_URL}
ENV NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=${NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY}
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY apps/web/package.json apps/web/
COPY apps/admin/package.json apps/admin/
COPY packages/api/package.json packages/api/
COPY packages/database/package.json packages/database/
COPY packages/notifications/package.json packages/notifications/
COPY packages/shared/package.json packages/shared/
COPY packages/frontend-core/package.json packages/frontend-core/

RUN pnpm install --frozen-lockfile

COPY apps/admin apps/admin
COPY packages/shared packages/shared
COPY packages/frontend-core packages/frontend-core
COPY scripts/next-security-headers.cjs scripts/next-security-headers.cjs
COPY scripts/load-monorepo-env.cjs scripts/load-monorepo-env.cjs

RUN mkdir -p apps/admin/public

ENV CI=true
ENV NEXT_STANDALONE=1
RUN pnpm --filter @queueplatform/shared build && pnpm --filter @queueplatform/frontend-core build && pnpm --filter @queueplatform/admin build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0

RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/.next/static ./apps/admin/.next/static
COPY --from=builder --chown=nextjs:nodejs /app/apps/admin/public ./apps/admin/public

USER nextjs
EXPOSE 3000

CMD ["node", "apps/admin/server.js"]
