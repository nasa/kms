#!/usr/bin/env bash

set -euo pipefail

# Calls the synchronous metadata-correction endpoint for one collection concept id.
#
# Usage:
#   KMS_AUTHORIZATION='Bearer <token>' \
#     ./scripts/local/call_metadata_correction_sync_endpoint.sh <sit|uat|prod> <collectionConceptId>
#
# Examples:
#   KMS_AUTHORIZATION='Bearer eyJ...' \
#     ./scripts/local/call_metadata_correction_sync_endpoint.sh sit C1234567890-PROV
#
#   KMS_AUTHORIZATION='ABC-1' \
#     ./scripts/local/call_metadata_correction_sync_endpoint.sh uat C1234567890-PROV
#
# Notes:
# - The KMS API route is:
#     PUT /metadata_correction/{collectionConceptId}
# - `KMS_AUTHORIZATION` is passed through exactly as the Authorization header value.
#   That means you can supply either:
#   - a Launchpad token, or
#   - a full `Bearer <edl-access-token>` value
# - Set `KMS_BASE_URL` to override the default environment mapping if needed.

usage() {
  cat <<'EOF'
Usage:
  KMS_AUTHORIZATION='<Authorization header value>' \
    ./scripts/local/call_metadata_correction_sync_endpoint.sh <sit|uat|prod> <collectionConceptId>

Examples:
  KMS_AUTHORIZATION='Bearer eyJ...' \
    ./scripts/local/call_metadata_correction_sync_endpoint.sh sit C1234567890-PROV

  KMS_AUTHORIZATION='ABC-1' \
    ./scripts/local/call_metadata_correction_sync_endpoint.sh prod C1234567890-PROV

Environment:
  KMS_AUTHORIZATION  Authorization header value to pass through exactly as provided.
  KMS_BASE_URL       Optional override for the KMS base URL.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

ENVIRONMENT="${1:-}"
COLLECTION_CONCEPT_ID="${2:-}"

if [[ -z "$ENVIRONMENT" || -z "$COLLECTION_CONCEPT_ID" ]]; then
  usage >&2
  exit 1
fi

AUTHORIZATION_VALUE="${KMS_AUTHORIZATION:?Missing KMS_AUTHORIZATION environment variable.}"

case "$ENVIRONMENT" in
  sit)
    DEFAULT_BASE_URL="https://cmr.sit.earthdata.nasa.gov/kms"
    ;;
  uat)
    DEFAULT_BASE_URL="https://cmr.uat.earthdata.nasa.gov/kms"
    ;;
  prod)
    DEFAULT_BASE_URL="https://cmr.earthdata.nasa.gov/kms"
    ;;
  *)
    echo "Unsupported environment \"$ENVIRONMENT\". Expected one of: sit, uat, prod" >&2
    exit 1
    ;;
esac

BASE_URL="${KMS_BASE_URL:-$DEFAULT_BASE_URL}"
ENCODED_CONCEPT_ID="$(node -e "process.stdout.write(encodeURIComponent(process.argv[1]))" "$COLLECTION_CONCEPT_ID")"
REQUEST_URL="${BASE_URL}/metadata_correction/${ENCODED_CONCEPT_ID}"

echo "[call-metadata-correction-sync-endpoint] PUT ${REQUEST_URL}" >&2
echo "[call-metadata-correction-sync-endpoint] Authorization header: present" >&2

curl \
  --silent \
  --show-error \
  --fail-with-body \
  --request PUT \
  --header "Authorization: ${AUTHORIZATION_VALUE}" \
  --header 'Accept: application/json' \
  "$REQUEST_URL"

echo >&2
