#!/bin/sh
set -e

# Centrifugo v6 env vars: prefix CENTRIFUGO_, uppercase, single underscores between
# nested config keys (see https://centrifugal.dev/docs/server/configuration).

# Redis engine — Railway injects REDIS_URL when Redis is linked.
# Centrifugo v6 expects host:port in ENGINE_REDIS_ADDRESS; credentials via USER/PASSWORD.
if [ -z "${CENTRIFUGO_ENGINE_REDIS_ADDRESS:-}" ]; then
  redis_url="${REDIS_URL:-${REDIS_PRIVATE_URL:-}}"
  if [ -n "${redis_url}" ]; then
    redis_hostport="${redis_url#*://}"
    redis_hostport="${redis_hostport#*@}"
    export CENTRIFUGO_ENGINE_REDIS_ADDRESS="${redis_hostport}"
    if [ "${redis_url}" != "${redis_hostport}" ]; then
      redis_auth="${redis_url#*://}"
      redis_auth="${redis_auth%%@*}"
      if [ -n "${redis_auth}" ] && [ "${redis_auth#*:}" != "${redis_auth}" ]; then
        export CENTRIFUGO_ENGINE_REDIS_USER="${redis_auth%%:*}"
        export CENTRIFUGO_ENGINE_REDIS_PASSWORD="${redis_auth#*:}"
      fi
    fi
  fi
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
