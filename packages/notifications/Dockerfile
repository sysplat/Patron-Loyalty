# ─── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/notifications/package.json packages/notifications/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile

COPY packages/notifications packages/notifications
COPY packages/shared packages/shared

RUN pnpm --filter @queueplatform/shared build
RUN pnpm --filter @queueplatform/notifications build

# ─── Stage 2: Production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN corepack enable && corepack prepare pnpm@latest --activate

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml tsconfig.base.json ./
COPY packages/notifications/package.json packages/notifications/
COPY packages/shared/package.json packages/shared/

RUN pnpm install --frozen-lockfile --prod

COPY --from=builder /app/packages/notifications/dist packages/notifications/dist
COPY --from=builder /app/packages/shared/dist packages/shared/dist

CMD ["node", "packages/notifications/dist/index.js"]
