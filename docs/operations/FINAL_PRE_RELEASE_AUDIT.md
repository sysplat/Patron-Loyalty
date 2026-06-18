# Final pre-release audit

Release checklist before promoting `main` to production.

## 1. CI and builds

```bash
pnpm validate
pnpm format:check
pnpm --filter @queueplatform/web build
pnpm --filter @queueplatform/admin build
pnpm check:bundle-budgets
```

## 2. Database

```bash
bash scripts/railway-db-migrate.sh   # or staging equivalent
pnpm --filter @queueplatform/database audit:serve-surface
```

## 3. Security guards

```bash
pnpm security:check:public-safeguards
pnpm security:check:auth-remediation
pnpm security:check:display-session
pnpm security:check:tenant-isolation
```

## 4. Staging SMS / email delivery smoke

Requires running API + notifications worker against **staging** credentials (Twilio + SendGrid). Do not run against production tenant data without approval.

### Prerequisites

| Variable                                                         | Service             | Notes                                                           |
| ---------------------------------------------------------------- | ------------------- | --------------------------------------------------------------- |
| `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` | notifications + API | SMS send + status callbacks                                     |
| `TWILIO_SENDGRID_API_KEY`, `TWILIO_SENDGRID_FROM_EMAIL`          | notifications       | HTTPS SendGrid API (not SMTP)                                   |
| `TWILIO_STATUS_CALLBACK_URL`                                     | API                 | `https://<api-host>/api/v1/notifications/webhook/twilio-status` |
| `SMS_TEST_NUMBER`                                                | your machine        | E.164 number that can receive trial/staging SMS                 |
| `SMOKE_EMAIL_TO`                                                 | your machine        | Inbox you control; must be verified on SendGrid trial           |

Start notifications worker locally or confirm Railway `qms-notifications` is healthy.

### Run

```bash
API_BASE=https://<staging-api-host>/api/v1 \
  EXPOSE_INVITE_TOKENS=true \
  SMS_TEST_NUMBER=+1XXXXXXXXXX \
  SMOKE_EMAIL_TO=you@example.com \
  pnpm smoke:rbac-e2e
```

**Pass criteria:**

- Script exits 0
- SMS received at `SMS_TEST_NUMBER` (check Twilio Console → Monitor if not)
- Email received at `SMOKE_EMAIL_TO` (check SendGrid Activity)
- Remove or set `EXPOSE_INVITE_TOKENS=false` on API immediately after the run

Alternative broader matrix:

```bash
API_BASE=https://<staging-api-host>/api/v1 pnpm smoke:matrix
```

### Sign-off

| Channel | Sent | Delivered | Provider log link | Date |
| ------- | ---- | --------- | ----------------- | ---- |
| SMS     |      |           | Twilio            |      |
| Email   |      |           | SendGrid          |      |

## 5. Realtime (Centrifugo webhook)

See `docs/deployment/OPS_GATE_REALTIME.md` and:

```bash
pnpm check:ops-gates
```

## 6. CSP strict mode (optional staging)

1. On **staging** web + admin, set `CSP_REPORT_ONLY=1` for one release; watch browser console / CSP reports.
2. After zero violations for 48h, set `CSP_STRICT_MODE=1` on staging; smoke login, dashboard, serve, track.
3. Repeat for production when staging is clean.

Reference: `scripts/next-security-headers.cjs`, `docs/deployment/DEPLOYMENT_GUIDE.md` § CSP staged rollout.
