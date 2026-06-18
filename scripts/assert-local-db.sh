#!/usr/bin/env bash
# Blocks local dev commands when DATABASE_URL targets Railway (accidental prod migrations).
set -euo pipefail
URL="${DATABASE_URL:-}"
if [[ -z "$URL" ]]; then
  exit 0
fi
if echo "$URL" | grep -qE 'rlwy\.net|railway\.internal|\.railway\.app'; then
  echo "Refusing local dev: DATABASE_URL points at Railway."
  echo "Use Homebrew Postgres — cp .env.local.example .env.local or run: pnpm setup:local-brew"
  echo "Then: pnpm dev:full:local"
  exit 1
fi
