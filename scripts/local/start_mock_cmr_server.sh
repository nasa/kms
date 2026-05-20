#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"

DEFAULT_FIXTURE_FILE="${ROOT_DIR}/scripts/local/fixtures/metadata_correction_smoke.full_path.example.json"
FIXTURE_FILE="${1:-${FIXTURE_FILE:-${DEFAULT_FIXTURE_FILE}}}"
MOCK_CMR_PORT="${MOCK_CMR_PORT:-3020}"

echo "Starting mock CMR server on http://127.0.0.1:${MOCK_CMR_PORT}"
echo "Using fixture ${FIXTURE_FILE}"

FIXTURE_FILE="${FIXTURE_FILE}" \
MOCK_CMR_PORT="${MOCK_CMR_PORT}" \
node "${ROOT_DIR}/scripts/local/mock_cmr_server.mjs" "${FIXTURE_FILE}"
