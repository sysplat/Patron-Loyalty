#!/bin/bash
set -e

# Source .env if exists
if [ -f .env ]; then
  # Load env vars safely
  set -a
  source .env
  set +a
fi

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL is not set."
  exit 1
fi

TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_DIR="backups"
mkdir -p "$BACKUP_DIR"

BACKUP_FILE="${BACKUP_DIR}/qms_db_backup_${TIMESTAMP}.dump"

echo "Taking database dump from Railway (using /usr/local/opt/libpq/bin/pg_dump)..."
/usr/local/opt/libpq/bin/pg_dump "$DATABASE_URL" -F c > "$BACKUP_FILE"

echo "Backup successfully saved to $BACKUP_FILE"
