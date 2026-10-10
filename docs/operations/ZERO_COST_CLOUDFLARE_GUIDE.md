# Zero-Cost Infrastructure & Cloudflare Transition Guide

This document outlines how to minimize hosting and compute expenses for **Patron Loyalty** to nearly **$0.00/month** when traffic is idle.

---

## 1. Immediate Scale-to-Zero on Railway

We have updated the Railway configurations to enable scale-to-zero across all HTTP web services:

- [`railway/loyalty.railway.json`](../../railway/loyalty.railway.json): `"sleepApplication": true`
- [`railway/admin.railway.json`](../../railway/admin.railway.json): `"sleepApplication": true`
- [`railway/api.railway.json`](../../railway/api.railway.json): `"sleepApplication": true`

### What this means:

- When nobody makes requests to the web services or the API, Railway suspends the containers.
- Compute hours drop to near zero.
- When a user visits the URL, Railway spins the container back up within a few seconds (cold start).

---

## 2. Eliminating Database & Cache Costs ($0 Serverless DBs)

Railway charges continuous monthly rates for provisioned PostgreSQL and Redis instances even when idle. To achieve true $0 idle costs:

### A. Neon Serverless Postgres (Free Tier)

1. Create a free account at [neon.tech](https://neon.tech).
2. Create a database project. Neon automatically sleeps compute when there are no active connections.
3. Replace the `DATABASE_URL` environment variable on `pl-api` and worker services with the Neon pooled connection string:
   ```text
   DATABASE_URL=postgres://[user]:[password]@[host]/[dbname]?sslmode=require&pgbouncer=true
   DIRECT_URL=postgres://[user]:[password]@[host]/[dbname]?sslmode=require
   ```
4. Run migrations: `pnpm db:migrate` (or let API run startup migrations).

### B. Upstash Serverless Redis (Free Tier)

1. Create a free database at [upstash.com](https://upstash.com) (10,000 commands/day free).
2. Set `REDIS_URL` on `pl-api`, `notifications`, and `scheduler` to the Upstash Redis URI:
   ```text
   REDIS_URL=rediss://default:[password]@[host]:6379
   ```

---

## 3. Cloudflare Pages for Frontends (`apps/loyalty` & `apps/admin`)

Cloudflare Pages provides completely free hosting with unlimited requests on its free tier.

### Option A: Cloudflare Pages with Git Integration (Recommended)

1. Go to **Cloudflare Dashboard** → **Workers & Pages** → **Create application** → **Pages** → **Connect to Git**.
2. Select the `Patron-Loyalty` repository.
3. Configure build settings:
   - **Framework preset**: `Next.js`
   - **Root directory**: `apps/loyalty` (or `apps/admin`)
   - **Build command**: `pnpm --filter @queueplatform/loyalty build`
   - **Output directory**: `.next`
   - **Node.js compatibility flag**: In Settings → Environment variables, add:
     - `NODE_VERSION` = `22`
     - `NEXT_PUBLIC_API_URL` = `https://loyalty-api.sysplat.com/api/v1`
4. Attach your custom domains:
   - `loyalty.sysplat.com`
   - `loyalty-admin.sysplat.com`

---

## 4. Consolidating Background Workers & Centrifugo

To prevent background workers from keeping containers active:

- **Workers**: `notifications` and `scheduler` can be suspended or merged into on-demand triggers if no active campaigns or bulk email jobs are scheduled.
- **Centrifugo**: If realtime presence isn't critical while idle, suspend `pl-centrifugo` or let client polling serve as a fallback.

---

## Summary of Monthly Savings

| Component           | Before (Continuous 24/7) | After (Scale-to-Zero & Free Edge)        |
| :------------------ | :----------------------- | :--------------------------------------- |
| Next.js Loyalty App | ~$5–$10/mo               | **$0.00** (Cloudflare Pages or Sleeping) |
| Next.js Admin App   | ~$5–$10/mo               | **$0.00** (Cloudflare Pages or Sleeping) |
| NestJS REST API     | ~$10–$15/mo              | **$0.00** (Sleeping container on idle)   |
| PostgreSQL          | ~$5–$10/mo               | **$0.00** (Neon Serverless free tier)    |
| Redis               | ~$3–$5/mo                | **$0.00** (Upstash Serverless free tier) |
| **Total**           | **~$30–$50+/mo**         | **~$0.00/mo**                            |
