# Load Testing Playbook

This repository includes a lightweight load harness for validating ticket issuance stability under concurrent demand.

## Goals

- Validate high-concurrency behavior for public issuance endpoints.
- Capture reproducible artifacts for release and compliance evidence.
- Separate capacity testing from throttle-boundary testing.

## Scenarios

- `issue`: `POST /api/v1/tickets/issue`
- `join`: `POST /api/v1/service-queue/join`

Both scenarios run with configurable total requests, concurrency, and request staggering.

## Required environment variables

- `LOAD_TEST_BASE_URL` (example: `https://staging.example.com/api/v1`)
- `LOAD_TEST_ORG_ID`
- `LOAD_TEST_BRANCH_ID`
- `LOAD_TEST_QUEUE_ID`
- `LOAD_TEST_SERVICE_ID`

Optional tuning:

- `LOAD_TEST_TOTAL_REQUESTS` (default `100`)
- `LOAD_TEST_CONCURRENCY` (default `20`)
- `LOAD_TEST_STAGGER_MS` (default `8`)
- `LOAD_TEST_ARTIFACT_DIR` (default `scripts/load/artifacts`)

## Running locally

Issue scenario:

```bash
pnpm load:issue
```

Join scenario:

```bash
pnpm load:join
```

Combined staging suite:

```bash
pnpm load:staging
```

Each run writes a JSON artifact to `scripts/load/artifacts`.

## Artifact verification

Use `scripts/load/verify-load-artifact.mjs` to enforce thresholds:

```bash
node scripts/load/verify-load-artifact.mjs scripts/load/artifacts/load-issue-<timestamp>.json
```

Optional threshold env vars:

- `LOAD_MAX_P95_MS` (default `800`)
- `LOAD_MAX_5XX` (default `0`)
- `LOAD_MAX_DUPLICATES` (default `0`)

## Staging-safe throttle controls

To avoid public-throttle saturation during capacity runs, non-production envs can override limits:

- `THROTTLE_SHORT_LIMIT`
- `THROTTLE_MEDIUM_LIMIT`
- `LOAD_TEST_PUBLIC_ISSUE_LIMIT`
- `LOAD_TEST_PUBLIC_JOIN_LIMIT`
- `LOAD_TEST_PUBLIC_LOOKUP_LIMIT`

Keep production defaults unchanged. For compliance tests, deliberately use baseline limits to capture `429` evidence.

## Suggested SLO guardrails

- `5xx` errors: near zero during nominal concurrency
- Duplicate display numbers: zero for successful issuance requests
- P95 response time: environment-specific target (start with `< 800ms` in staging)

## Evidence and audit usage

- Store run artifacts from release candidate windows.
- Capture one throttle-boundary run that demonstrates expected `429` behavior.
- Reference these artifacts in compliance documentation where required.
