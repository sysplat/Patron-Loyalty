#!/usr/bin/env bash
# Ensures .env.local exists for Homebrew Postgres dev (overrides Railway URLs in .env).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
USER_NAME="$(whoami)"

if [[ -f .env.local ]]; then
  if grep -qE 'rlwy\.net|railway\.internal' .env.local 2>/dev/null; then
    echo "Warning: .env.local still points at Railway. Use Homebrew Postgres, e.g.:"
    echo "  DATABASE_URL=postgresql://${USER_NAME}@127.0.0.1:5432/queueplatform?sslmode=disable"
    exit 1
  fi
  exit 0
fi

if [[ ! -f .env.local.example ]]; then
  echo "Missing .env.local.example"
  exit 1
fi

sed "s/YOUR_MAC_USER/${USER_NAME}/g" .env.local.example > .env.local
if [[ -f .env.local ]] && grep -q '^LOCAL_PG_PASSWORD=' .env.local 2>/dev/null; then
  PW="$(grep '^LOCAL_PG_PASSWORD=' .env.local | cut -d= -f2- | tr -d '"' | tr -d "'")"
  if [[ -n "$PW" ]]; then
    ENC_PW="$(python3 -c "import urllib.parse,sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$PW")"
    sed -i.bak "s|^DATABASE_URL=.*|DATABASE_URL=postgresql://${USER_NAME}:${ENC_PW}@127.0.0.1:5432/queueplatform?sslmode=disable|" .env.local
    rm -f .env.local.bak
  fi
fi
echo "Created .env.local (Homebrew Postgres @ 127.0.0.1:5432)."
echo "If TCP auth fails, set LOCAL_PG_PASSWORD in .env.local, then re-run: pnpm setup:env-local"
