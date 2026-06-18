#!/usr/bin/env bash
# Exercise auth endpoints that enqueue email (verification + password reset).
# Prerequisites: Postgres, Redis, API, BullMQ notifications worker.
# Dev: inbox at http://localhost:8025 (Mailpit via docker compose) — worker: `pnpm dev:notifications`
# In non-production, register / forgot-password return raw tokens so this script runs without opening inbox.
#
# Usage: bash scripts/test-auth-email-flows.sh
# Env: API_BASE=http://localhost:4000/api/v1 (default)
# SKIP_THROTTLE_WAIT=1 skips the unknown-email assertion and 65s sleep (avoids throttle / long wait).

set -euo pipefail

API_BASE="${API_BASE:-http://localhost:4000/api/v1}"

json_post() {
  local url="$1"
  local data="$2"
  local tmp status
  tmp="$(mktemp)"
  status="$(curl -s -o "$tmp" -w "%{http_code}" "$url" \
    -X POST \
    -H "Content-Type: application/json" \
    -d "$data")"
  printf '%s' "$(cat "$tmp")"
  printf '\n%s' "$status"
  rm -f "$tmp"
}

die() {
  echo "ERROR: $*" >&2
  exit 1
}

command -v python3 >/dev/null 2>&1 || die "python3 required"

echo "Checking API (${API_BASE}/health)…"
curl -sf "${API_BASE}/health" >/dev/null || die "API not reachable (${API_BASE}/health). Start Nest."

EMAIL="qp-auth-flow-$(date +%s)@example.com"
echo "Using test email: $EMAIL"

REG_BLOCK="$(json_post "${API_BASE}/auth/register" "{\"businessName\":\"Auth Flow CI\",\"firstName\":\"Test\",\"lastName\":\"User\",\"email\":\"${EMAIL}\",\"password\":\"OldPass456!xyz\",\"acceptLegal\":true}")"
REG_CODE="$(echo "$REG_BLOCK" | tail -n 1)"
REG_BODY="$(echo "$REG_BLOCK" | sed '$d')"

[[ "$REG_CODE" == "200" || "$REG_CODE" == "201" ]] || die "register failed HTTP=$REG_CODE body=$REG_BODY"

VTOKEN="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d['data'].get('verificationToken') or '')" "$REG_BODY")"
PROD_MODE=0
if [[ -z "$VTOKEN" ]]; then
  PROD_MODE=1
  echo "INFO: verificationToken omitted by API (likely production mode); running production-safe checks."
else
  VER_BLOCK="$(json_post "${API_BASE}/auth/verify-email" "{\"token\":\"${VTOKEN}\"}")"
  VER_CODE="$(echo "$VER_BLOCK" | tail -n 1)"
  VER_BODY="$(echo "$VER_BLOCK" | sed '$d')"
  [[ "$VER_CODE" == "200" ]] || die "verify-email failed HTTP=$VER_CODE body=$VER_BODY"
  echo "PASS verify-email"
fi

FP_BLOCK="$(json_post "${API_BASE}/auth/forgot-password" "{\"email\":\"${EMAIL}\"}")"
FP_CODE="$(echo "$FP_BLOCK" | tail -n 1)"
FP_BODY="$(echo "$FP_BLOCK" | sed '$d')"
[[ "$FP_CODE" == "200" ]] || die "forgot-password failed HTTP=$FP_CODE body=$FP_BODY"

RTOKEN="$(python3 -c "import json,sys; d=json.loads(sys.argv[1]); print(d['data'].get('resetToken') or '')" "$FP_BODY")"
if [[ "$PROD_MODE" == "0" ]]; then
  [[ -n "$RTOKEN" ]] || die "No resetToken — use NODE_ENV=development locally"

  RP_BLOCK="$(json_post "${API_BASE}/auth/reset-password" "{\"token\":\"${RTOKEN}\",\"password\":\"NewPass789!abc\"}")"
  RP_CODE="$(echo "$RP_BLOCK" | tail -n 1)"
  RP_BODY="$(echo "$RP_BLOCK" | sed '$d')"
  [[ "$RP_CODE" == "200" ]] || die "reset-password failed HTTP=$RP_CODE body=$RP_BODY"
  echo "PASS reset-password"

  LG_BLOCK="$(json_post "${API_BASE}/auth/login" "{\"email\":\"${EMAIL}\",\"password\":\"NewPass789!abc\"}")"
  LG_CODE="$(echo "$LG_BLOCK" | tail -n 1)"
  LG_BODY="$(echo "$LG_BLOCK" | sed '$d')"
  [[ "$LG_CODE" == "200" ]] || die "login (new password) HTTP=$LG_CODE body=$LG_BODY"
  echo "PASS login (new password)"

  BAD_BLOCK="$(json_post "${API_BASE}/auth/login" "{\"email\":\"${EMAIL}\",\"password\":\"OldPass456!xyz\"}")"
  BAD_CODE="$(echo "$BAD_BLOCK" | tail -n 1)"
  [[ "$BAD_CODE" == "401" ]] || die "expected 401 for old password, got HTTP=$BAD_CODE"
  echo "PASS login rejects old password"
else
  [[ -z "$RTOKEN" ]] || die "Production response leaked resetToken unexpectedly"
  echo "PASS forgot-password accepted without token leakage (production-safe path)"
fi

if [[ "${SKIP_THROTTLE_WAIT:-}" == "1" ]]; then
  echo "SKIP_THROTTLE_WAIT=1 — skipped unknown-email forgot-password check"
else
  echo "Waiting 65s (auth throttle before second forgot-password)…"
  sleep 65

  UNK_BLOCK="$(json_post "${API_BASE}/auth/forgot-password" "{\"email\":\"nonexistent-${EMAIL}\"}")"
  UNK_CODE="$(echo "$UNK_BLOCK" | tail -n 1)"
  UNK_BODY="$(echo "$UNK_BLOCK" | sed '$d')"
  [[ "$UNK_CODE" == "200" ]] || die "forgot unknown email HTTP=$UNK_CODE body=$UNK_BODY"
  python3 -c "import json,sys; d=json.loads(sys.argv[1]); assert 'resetToken' not in d.get('data',{})" "$UNK_BODY"
  echo "PASS forgot-password unknown email (no resetToken leak)"
fi

echo ""
echo "All checks passed."
echo "UI: http://localhost:3001/forgot-password , verify-email links use APP_URL from API emails."
