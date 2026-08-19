#!/bin/sh
set -e

# Centrifugo v6 env vars: prefix CENTRIFUGO_, uppercase, single underscores between
# nested config keys (see https://centrifugal.dev/docs/server/configuration).

# Centrifugo v6 on Railway uses docker/centrifugo.railway.json (no engine block → memory engine).
# REDIS_URL is linked for future redis engine scaling; memory is fine for a single replica.
unset CENTRIFUGO_ENGINE_REDIS_ADDRESS CENTRIFUGO_ENGINE_REDIS_USER CENTRIFUGO_ENGINE_REDIS_PASSWORD CENTRIFUGO_ENGINE_TYPE 2>/dev/null || true

# QMS env names → Centrifugo v6 (bundled docker/centrifugo.json uses local dev placeholders).
if [ -n "${CENTRIFUGO_SECRET:-}" ]; then
  export CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY="${CENTRIFUGO_SECRET}"
elif [ -n "${CENTRIFUGO_TOKEN_HMAC_SECRET_KEY:-}" ]; then
  export CENTRIFUGO_CLIENT_TOKEN_HMAC_SECRET_KEY="${CENTRIFUGO_TOKEN_HMAC_SECRET_KEY}"
fi

if [ -n "${CENTRIFUGO_API_KEY:-}" ]; then
  export CENTRIFUGO_HTTP_API_KEY="${CENTRIFUGO_API_KEY}"
fi

# QMS-only env names are consumed above; unset so Centrifugo v6 does not warn on startup.
unset CENTRIFUGO_SECRET CENTRIFUGO_API_KEY CENTRIFUGO_TOKEN_HMAC_SECRET_KEY REDIS_URL REDIS_PRIVATE_URL 2>/dev/null || true

exec centrifugo -c /centrifugo/config.json --http_server.port="${PORT:-8000}"
