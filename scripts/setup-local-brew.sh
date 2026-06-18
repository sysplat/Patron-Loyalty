#!/usr/bin/env bash
# Option B: Postgres + Redis on macOS via Homebrew (no Docker for DB/Redis).
# Run from repo root: pnpm setup:local-brew
set -euo pipefail

export HOMEBREW_NO_AUTO_UPDATE="${HOMEBREW_NO_AUTO_UPDATE:-1}"

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew is required: https://brew.sh"
  exit 1
fi

prepend_pg_path() {
  local d
  for d in \
    /opt/homebrew/opt/postgresql@16/bin \
    /opt/homebrew/opt/postgresql@15/bin \
    /opt/homebrew/opt/postgresql@14/bin \
    /opt/homebrew/opt/postgresql/bin \
    /usr/local/opt/postgresql@16/bin \
    /usr/local/opt/postgresql@15/bin \
    /usr/local/opt/postgresql@14/bin \
    /usr/local/opt/postgresql/bin; do
    [[ -d "$d" ]] && PATH="$d:$PATH"
  done
  export PATH
}

brew_install_safe() {
  local pkg="$1"
  brew list "$pkg" >/dev/null 2>&1 && return 0
  if brew install "$pkg"; then
    return 0
  fi
  echo "Warning: brew install $pkg failed (disk/memory/network). Fix brew, then re-run."
  return 1
}

brew_install_safe redis || {
  echo "Redis is required for the API and workers."
  exit 1
}
brew services start redis || true

prepend_pg_path

export PGHOST="${PGHOST:-127.0.0.1}"
export PGPORT="${PGPORT:-5432}"

if pg_isready -t 2 -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
  echo "PostgreSQL already accepting connections on ${PGHOST}:${PGPORT}."
else
  STARTED=0
  for svc in postgresql@14 postgresql@16 postgresql@15 postgresql; do
    if brew list "$svc" >/dev/null 2>&1; then
      echo "Starting Homebrew service: $svc"
      brew services start "$svc" || true
      STARTED=1
      prepend_pg_path
      break
    fi
  done

  if [[ "$STARTED" -eq 0 ]]; then
    echo "No Homebrew PostgreSQL found. Installing postgresql@14 (often coexists better than @16 when another major is linked)."
    if brew_install_safe postgresql@14 || brew_install_safe postgresql@16 || brew_install_safe postgresql; then
      for svc in postgresql@14 postgresql@16 postgresql; do
        brew list "$svc" >/dev/null 2>&1 || continue
        brew services start "$svc" || true
        prepend_pg_path
        break
      done
    fi
  fi

  echo "Waiting for PostgreSQL on ${PGHOST}:${PGPORT}..."
  for _ in {1..45}; do
    if pg_isready -t 2 -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
      break
    fi
    sleep 1
  done
  if ! pg_isready -t 2 -h "$PGHOST" -p "$PGPORT" >/dev/null 2>&1; then
    echo "PostgreSQL did not become ready. Try: brew services list"
    echo "If postgresql@16 failed initdb (shared memory), use postgresql@14: brew install postgresql@14 && brew services start postgresql@14"
    exit 1
  fi
fi

# -w: never prompt for a password (fails fast if peer/trust is not configured for TCP).
PGCONNECT_TIMEOUT=5 createdb -h "$PGHOST" -p "$PGPORT" -w queueplatform 2>/dev/null || true

USER_NAME="$(whoami)"
echo ""
echo "Done. Add to your .env (Docker Compose used 5433; Homebrew defaults to 5432):"
echo "  DATABASE_URL=postgresql://${USER_NAME}@${PGHOST}:${PGPORT}/queueplatform?sslmode=disable"
echo "  REDIS_URL=redis://127.0.0.1:6379"
echo ""
echo "Then: cp .env.example .env  (merge the lines above), pnpm install, pnpm db:push"
echo "Run API / web / admin / notifications in separate terminals (see root package.json)."
