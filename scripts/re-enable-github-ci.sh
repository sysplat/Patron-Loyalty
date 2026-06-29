#!/usr/bin/env bash
# Re-enable GitHub Actions CI after monthly minutes reset (e.g. July 2026).
# Usage: ./scripts/re-enable-github-ci.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${ROOT}/.github/workflows/ci-patron-loyalty.yml.disabled"
DEST="${ROOT}/.github/workflows/ci.yml"
if [[ ! -f "$SRC" ]]; then
  echo "Missing ${SRC} — CI may already be enabled." >&2
  exit 1
fi
if [[ -f "$DEST" ]]; then
  echo "ci.yml already exists — remove or rename it before re-enabling." >&2
  exit 1
fi
# Strip the DISABLED header comment block (first 3 lines)
tail -n +4 "$SRC" > "$DEST"
echo "CI re-enabled: .github/workflows/ci.yml"
echo "Optional: mv .github/workflows/staging-soak-patron-loyalty.yml.disabled .github/workflows/staging-soak-patron-loyalty.yml"
