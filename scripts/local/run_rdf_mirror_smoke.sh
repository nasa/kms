#!/usr/bin/env bash

set -euo pipefail

# Start KMS with `npm run start-local`, then run:
# KMS_AUTHORIZATION='<authorization token>' ./scripts/local/run_rdf_mirror_smoke.sh
# Local startup defaults RDF_MIRROR_SOURCE_ENV to local, exercising local export and import.

KMS_BASE_URL="${KMS_BASE_URL:-http://127.0.0.1:3013}"
AUTHORIZATION_VALUE="${KMS_AUTHORIZATION:?Missing KMS_AUTHORIZATION environment variable.}"

curl --silent --show-error --fail-with-body \
  --request POST \
  --header "Authorization: ${AUTHORIZATION_VALUE}" \
  "${KMS_BASE_URL}/rdf/mirror" | jq .

curl --silent --show-error --fail-with-body \
  "${KMS_BASE_URL}/concept_versions/version_type/all"
printf '\n'

curl --silent --show-error --fail-with-body "${KMS_BASE_URL}/status"
printf '\n'
