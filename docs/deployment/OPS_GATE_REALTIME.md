# Ops gate: Centrifugo realtime webhook

Production API **requires** `CENTRIFUGO_WEBHOOK_SECRET` (`packages/api/src/main.ts`). The API validates inbound proxy calls via header `x-centrifugo-webhook-secret` on `POST /api/v1/realtime/webhook`.

## Railway variables

### qms-api

| Variable                                    | Value                                            |
| ------------------------------------------- | ------------------------------------------------ |
| `CENTRIFUGO_WEBHOOK_SECRET`                 | Random 32+ char secret (same as Centrifugo side) |
| `CENTRIFUGO_SECRET`                         | JWT signing secret for client tokens             |
| `CENTRIFUGO_API_KEY` / `CENTRIFUGO_API_URL` | Server-side publish                              |

### Centrifugo service

Local dev uses `centrifugo.local.json` (`proxy_http_url` + `proxies` array) against Centrifugo **v5** CLI.

Railway deploys Centrifugo **v6** from `apps/centrifugo/Dockerfile`. Configure proxy to the **internal** API URL:

```text
REALTIME_WEBHOOK_PROXY_URL=http://<qms-api-internal-host>:4000/api/v1/realtime/webhook
CENTRIFUGO_WEBHOOK_SECRET=<same secret as API>
```

The entrypoint maps **`CENTRIFUGO_SECRET`** / **`CENTRIFUGO_API_KEY`** / **`REDIS_URL`** to Centrifugo **v6** env names (see `docker/centrifugo-entrypoint.sh`). Subscribe/connect proxy wiring for v6 uses a different HTTP payload shape than v5 `proxy_http_url`; production currently relies on JWT + `allow_subscribe_for_client` in `docker/centrifugo.json` until the webhook handler is upgraded.

**Important:** The API webhook handler expects the unified `{ method, params }` payload (connect / disconnect / subscribe). Match local `centrifugo.local.json` proxy paths. If subscribe authorization is not wired, clients may subscribe to channels without backend checks — treat missing proxy as a **release blocker**.

## Verify API side (any environment)

```bash
CENTRIFUGO_WEBHOOK_SECRET=your-secret \
  API_BASE=http://localhost:4000/api/v1 \
  pnpm check:ops-gates
```

Or manually:

```bash
curl -sS -X POST "$API_BASE/realtime/webhook" \
  -H 'Content-Type: application/json' \
  -H "x-centrifugo-webhook-secret: $CENTRIFUGO_WEBHOOK_SECRET" \
  -d '{"method":"connect","params":{"user":"smoke-user"}}'
```

Expect HTTP 200 and JSON `{ "result": {} }`. Wrong secret → 401.

## Verify end-to-end (staging)

1. Open web dashboard; confirm Centrifugo connects (`wss://` in network tab).
2. Trigger queue event (issue ticket); serve board updates without waiting for poll interval.
3. API logs: no repeated `Invalid realtime webhook secret`.

## Sign-off

| Check                                             | Pass | Date |
| ------------------------------------------------- | ---- | ---- |
| Secret set on qms-api                             |      |      |
| Proxy URL set on Centrifugo                       |      |      |
| `pnpm check:ops-gates` exit 0 against staging API |      |      |
| Live queue event propagates over WS               |      |      |
