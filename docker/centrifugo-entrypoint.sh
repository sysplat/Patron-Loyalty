#!/bin/sh
set -e

# Centrifugo v6 env vars: prefix CENTRIFUGO_, uppercase, single underscores between
# nested config keys (see https://centrifugal.dev/docs/server/configuration).

# Railway may inject split redis vars from prior ops; v6 expects a single URI in ADDRESS.
unset CENTRIFUGO_ENGINE_REDIS_USER CENTRIFUGO_ENGINE_REDIS_PASSWORD 2>/dev/null || true

redis_url="${REDIS_URL:-${REDIS_PRIVATE_URL:-}}"
if [ -n "${redis_url}" ]; then
  export CENTRIFUGO_ENGINE_TYPE=redis
  export CENTRIFUGO_ENGINE_REDIS_ADDRESS="${redis_url}"
fi

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
