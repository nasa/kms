#!/usr/bin/env bash

set -euo pipefail

# Downloads and validates the published and draft RDF gzip exports.
#
# Usage:
#   ./scripts/local/run_rdf_export_smoke.sh <sit|uat|prod> [outputDirectory]

usage() {
  cat <<'EOF'
Usage:
  ./scripts/local/run_rdf_export_smoke.sh <sit|uat|prod> [outputDirectory]

Environment:
  KMS_BASE_URL  Optional override for the KMS base URL.

The output directory defaults to /tmp/kms-rdf-export-smoke-<environment>.
EOF
}

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  usage
  exit 0
fi

ENVIRONMENT="${1:-}"

if [[ -z "$ENVIRONMENT" ]]; then
  usage >&2
  exit 1
fi

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
OUTPUT_DIRECTORY="${2:-/tmp/kms-rdf-export-smoke-${ENVIRONMENT}}"
mkdir -p "$OUTPUT_DIRECTORY"

download_export() {
  local version="$1"
  local response_file="${OUTPUT_DIRECTORY}/${version}.response.json"
  local gzip_file="${OUTPUT_DIRECTORY}/${version}.rdf.xml.gz"
  local rdf_file="${OUTPUT_DIRECTORY}/${version}.rdf.xml"

  echo "[rdf-export-smoke] POST ${BASE_URL}/rdf/export?version=${version}" >&2
  curl \
    --silent \
    --show-error \
    --fail-with-body \
    --request POST \
    --header 'Accept: application/json' \
    "${BASE_URL}/rdf/export?version=${version}" \
    --output "$response_file"

  local download_url
  download_url="$(jq --exit-status --raw-output '.downloadUrl' "$response_file")"

  curl \
    --silent \
    --show-error \
    --fail \
    --location \
    "$download_url" \
    --output "$gzip_file"

  gzip --test "$gzip_file"
  gzip --decompress --stdout "$gzip_file" > "$rdf_file"
  grep --quiet '<rdf:RDF' "$rdf_file"

  echo "[rdf-export-smoke] Valid ${version} export: ${gzip_file}" >&2
  echo "[rdf-export-smoke] Extracted RDF/XML: ${rdf_file}" >&2
}

download_export published
download_export draft

echo "[rdf-export-smoke] Passed. Artifacts are in ${OUTPUT_DIRECTORY}" >&2
