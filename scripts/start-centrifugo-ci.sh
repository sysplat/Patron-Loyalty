#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CONFIG_PATH="${ROOT_DIR}/docker/centrifugo.ci.json"
CONTAINER_NAME="${CENTRIFUGO_CI_CONTAINER_NAME:-qp-centrifugo-ci}"
IMAGE="${CENTRIFUGO_CI_IMAGE:-centrifugo/centrifugo:v6}"
PORT="${CENTRIFUGO_CI_PORT:-8000}"

if [[ ! -f "${CONFIG_PATH}" ]]; then
  echo "Missing Centrifugo CI config: ${CONFIG_PATH}" >&2
  exit 1
fi

docker rm -f "${CONTAINER_NAME}" >/dev/null 2>&1 || true

docker run -d \
  --name "${CONTAINER_NAME}" \
  -p "${PORT}:8000" \
  -v "${CONFIG_PATH}:/centrifugo/config.json:ro" \
  "${IMAGE}" \
  centrifugo -c /centrifugo/config.json

for _ in $(seq 1 45); do
  if curl -fsS "http://127.0.0.1:${PORT}/health" >/dev/null 2>&1; then
    echo "Centrifugo CI is ready on port ${PORT}"
    exit 0
  fi
  sleep 1
done

echo "Centrifugo CI failed to become healthy on port ${PORT}" >&2
docker logs "${CONTAINER_NAME}" || true
exit 1
