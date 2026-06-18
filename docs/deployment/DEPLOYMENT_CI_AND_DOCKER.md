# Deployment & CI failure prevention

Recurring production deploy failures often come from **two different pipelines** that do not run the same checks:

| Pipeline                                        | What it builds                                                    | Typical failure                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------- | ------------------------------------------------------------------------- |
| **CI** (`ci.yml`)                               | `pnpm --filter @queueplatform/web build` on the runner filesystem | Missing file in git, TypeScript error                                     |
| **Docker → GHCR** (`docker-*-ghcr.yml`)         | `docker build` with a **minimal COPY context**                    | `next.config.js` requires a script that was never `COPY`’d into the image |
| **Railway** (`qms-admin`, `qms-web`, `qms-api`) | GHCR image or Nixpacks                                            | Downstream of a failed Docker push, or wrong env                          |

The admin Docker failure on 2026-05-22 (`Cannot find module '../../scripts/load-monorepo-env.cjs'`) is the second case: **local and CI builds passed** because the full monorepo exists on disk; **Docker only had** `next-security-headers.cjs`, not `load-monorepo-env.cjs`.

---

## Before every push that touches deployable apps

Run from repo root:

```bash
pnpm install --frozen-lockfile
pnpm --filter @queueplatform/shared build
pnpm check:docker-build-context
pnpm --filter @queueplatform/web build
pnpm --filter @queueplatform/admin build
```

Optional but recommended after auth or dashboard changes:

```bash
node scripts/test-staff-multistep-rbac.mjs   # needs API on :4000
```

---

## Automated guard: `pnpm check:docker-build-context`

Script: `scripts/verify-docker-build-context.mjs`

For each Next app (`apps/web`, `apps/admin`), it:

1. Parses `next.config.js` for `require('../../scripts/...')` paths.
2. Asserts each file exists in the repo.
3. Asserts the app `Dockerfile` contains a matching `COPY scripts/...` line.

This runs in:

- **CI** (`ci.yml`) — fails the PR before merge.
- **Docker Admin / Web workflows** — fails before `docker build-push-action` pushes a broken image.

If you add a new `require('../../scripts/foo.cjs')` in `next.config.js`, you **must** add the same `COPY` to that app’s Dockerfile and add `scripts/foo.cjs` to the workflow `paths:` filter (see below).

---

## Dockerfile rules (Next.js apps)

Build context is always the **repo root**:

```bash
docker build -f apps/web/Dockerfile -t qms-web .
docker build -f apps/admin/Dockerfile -t qms-admin .
```

Each Next `Dockerfile` must `COPY`:

| Path                                | Why                                                           |
| ----------------------------------- | ------------------------------------------------------------- |
| `apps/<app>`                        | Application source                                            |
| `packages/shared`                   | Shared package + `pnpm --filter @queueplatform/shared build`  |
| `scripts/next-security-headers.cjs` | Used by `next.config.js`                                      |
| `scripts/load-monorepo-env.cjs`     | Used by `next.config.js` for API URL resolution at build time |

Keep **web and admin Dockerfiles in sync** for the `scripts/` COPY block. When one changes, update the other.

---

## GitHub Actions `paths:` filters

Docker workflows only run when listed paths change. If you add a new build-time script, update **both**:

- `apps/<app>/Dockerfile` (`COPY` line)
- `.github/workflows/docker-<app>-ghcr.yml` (`on.push.paths` includes `scripts/<new-file>.cjs`)

Otherwise a change to only the script might not rebuild the image on `main`.

---

## Railway / GHCR relationship

- **qms-web** and **qms-admin** usually deploy from GHCR images built by `docker-web-ghcr` and `docker-admin-ghcr`.
- If Docker push fails, Railway shows **deployment failed** even when API/web CI is green.
- Fix the Docker workflow first, wait for a successful `main` run, then redeploy or let Railway pick up `latest`.

Check runs:

```bash
gh run list --branch main --limit 10
gh run view <run-id> --log-failed
```

---

## When CI is green but Railway still fails

1. Open the failed Railway service log (build vs runtime).
2. Match the service to the workflow: admin → Docker Admin, web → Docker Web, api → Docker API or Nixpacks.
3. Reproduce locally:
   - Docker apps: `docker build -f apps/<app>/Dockerfile .`
   - API: same command as `NIXPACKS_BUILD_CMD` in [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md)
4. Add a guard (this doc, `check:docker-build-context`, or a CI step) so the same mistake cannot merge again.

---

## Incident log (add new rows)

| Date       | Failure                    | Root cause                                                    | Prevention added                                                                   |
| ---------- | -------------------------- | ------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| 2026-05-22 | `qms-admin` / Docker Admin | Admin Dockerfile missing `COPY scripts/load-monorepo-env.cjs` | Parity with web Dockerfile; `check:docker-build-context`; workflow `paths` updated |

---

## Related docs

- [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) — env vars, Railway, migrations
- [CONTRIBUTING.md](../CONTRIBUTING.md) — general PR expectations
