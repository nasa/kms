#!/usr/bin/env bash

set -euo pipefail

# Fetches one CMR concept by concept id and prints the native metadata payload to stdout.
#
# Usage:
#   ./scripts/local/fetch_concept.sh <sit|uat|prod> <conceptId> [revisionId]
#
# Examples:
#   ./scripts/local/fetch_concept.sh prod C1214622563-ISRO
#   ./scripts/local/fetch_concept.sh sit C1200413135-AMD_KOPRI 5
#
# Optional environment variables:
#   CMR_AUTHORIZATION  Optional Authorization header value to pass through exactly as provided.
#   CMR_BASE_URL       Optional override for the CMR base URL.
#   CMR_ACCEPT         Optional Accept header override, for example `application/dif10+xml`.
#
# Notes:
# - This uses the CMR Search concept retrieval route:
#     GET /search/concepts/{concept-id}
# - If no format is specified, CMR returns the native metadata format for the concept.
# - Progress is written to stderr so stdout stays a clean metadata payload.

usage() {
  cat <<'EOF'
Usage:
  ./scripts/local/fetch_concept.sh <sit|uat|prod> <conceptId> [revisionId]

Examples:
  ./scripts/local/fetch_concept.sh prod C1214622563-ISRO
  ./scripts/local/fetch_concept.sh sit C1200413135-AMD_KOPRI 5

Environment:
  CMR_AUTHORIZATION  Optional Authorization header value to pass through exactly as provided.
  CMR_BASE_URL       Optional override for the CMR base URL.
  CMR_ACCEPT         Optional Accept header override, for example `application/dif10+xml`.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

ENVIRONMENT="${1:-}"
CONCEPT_ID="${2:-}"
REVISION_ID="${3:-}"

if [[ -z "$ENVIRONMENT" || -z "$CONCEPT_ID" ]]; then
  usage >&2
  exit 1
fi

case "$ENVIRONMENT" in
  sit)
    DEFAULT_BASE_URL="https://cmr.sit.earthdata.nasa.gov"
    ;;
  uat)
    DEFAULT_BASE_URL="https://cmr.uat.earthdata.nasa.gov"
    ;;
  prod)
    DEFAULT_BASE_URL="https://cmr.earthdata.nasa.gov"
    ;;
  *)
    echo "Unsupported environment \"$ENVIRONMENT\". Expected one of: sit, uat, prod" >&2
    exit 1
    ;;
esac

BASE_URL="${CMR_BASE_URL:-$DEFAULT_BASE_URL}"
ENCODED_CONCEPT_ID="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$CONCEPT_ID")"

if [[ -n "$REVISION_ID" ]]; then
  REQUEST_URL="${BASE_URL}/search/concepts/${ENCODED_CONCEPT_ID}/${REVISION_ID}"
else
  REQUEST_URL="${BASE_URL}/search/concepts/${ENCODED_CONCEPT_ID}"
fi

echo "[fetch-concept] GET ${REQUEST_URL}" >&2

curl_args=(
  --silent
  --show-error
  --fail-with-body
  --request GET
)

if [[ -n "${CMR_AUTHORIZATION:-}" ]]; then
  echo "[fetch-concept] Authorization header: present" >&2
  curl_args+=(--header "Authorization: ${CMR_AUTHORIZATION}")
fi

if [[ -n "${CMR_ACCEPT:-}" ]]; then
  echo "[fetch-concept] Accept override: ${CMR_ACCEPT}" >&2
  curl_args+=(--header "Accept: ${CMR_ACCEPT}")
fi

curl "${curl_args[@]}" "$REQUEST_URL"

echo >&2
