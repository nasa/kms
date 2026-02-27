#!/usr/bin/env bash

set -euo pipefail

CONTAINER_NAME="${REDIS_CONTAINER_NAME:-kms-redis-local}"
HOST="${REDIS_CONNECT_HOST:-127.0.0.1}"
PORT="${REDIS_HOST_PORT:-6380}"

read_with_host_cli() {
  redis-cli -h "${HOST}" -p "${PORT}" INFO memory
}

read_with_docker_cli() {
  docker exec "${CONTAINER_NAME}" redis-cli INFO memory
}

print_metrics() {
  local info="$1"
  local used_bytes
  local used_human
  local peak_human
  local dataset_bytes
  local dataset_percent

  used_bytes="$(printf '%s\n' "${info}" | awk -F: '/^used_memory:/{print $2}' | tr -d '\r')"
  used_human="$(printf '%s\n' "${info}" | awk -F: '/^used_memory_human:/{print $2}' | tr -d '\r')"
  peak_human="$(printf '%s\n' "${info}" | awk -F: '/^used_memory_peak_human:/{print $2}' | tr -d '\r')"
  dataset_bytes="$(printf '%s\n' "${info}" | awk -F: '/^used_memory_dataset:/{print $2}' | tr -d '\r')"
  dataset_percent="$(printf '%s\n' "${info}" | awk -F: '/^used_memory_dataset_perc:/{print $2}' | tr -d '\r')"

  if [[ -z "${used_bytes}" ]]; then
    echo "Unable to read Redis memory metrics."
    exit 1
  fi

  echo "Redis memory usage:"
  echo "  used_memory_bytes: ${used_bytes}"
  awk -v bytes="${used_bytes}" 'BEGIN { printf "  used_memory_mib: %.2f\n", bytes / 1048576 }'
  echo "  used_memory_human: ${used_human:-n/a}"
  echo "  used_memory_peak_human: ${peak_human:-n/a}"
  echo "  used_memory_dataset_bytes: ${dataset_bytes:-n/a}"
  echo "  used_memory_dataset_perc: ${dataset_percent:-n/a}"
}

if command -v redis-cli >/dev/null 2>&1; then
  info="$(read_with_host_cli)"
  print_metrics "${info}"
  exit 0
fi

if docker ps --format '{{.Names}}' | grep -qx "${CONTAINER_NAME}"; then
  info="$(read_with_docker_cli)"
  print_metrics "${info}"
  exit 0
fi

echo "Could not connect to Redis."
echo "Start Redis first with: npm run redis:start"
echo "If using host redis-cli, install it or ensure '${CONTAINER_NAME}' is running for docker fallback."
exit 1
