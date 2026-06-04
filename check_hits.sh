#!/usr/bin/env bash

set -uo pipefail

# Define the list of categories, pref labels, and UUIDs in
# "Category|Pref Label|UUID" format.

TOKEN=

ITEMS=(
  "Example (Science Keyword)|OCEAN > PACIFIC OCEAN|a19e4450-64c4-4687-9080-cebded8a90eb"
  "processing_level_id|3 (Sensor Measurements)|808cdb91-d7eb-4625-96c5-0e2caed61636"
  "temporal-keywords|< 1 second|42a2f639-d1c3-4e82-a8b8-63f0f4a60ac6"
  "spatial-keywords (location)|CONTINENT|0a672f19-dad5-4114-819a-2eb55bdbb56a"
  "concepts (idnnode)|USA/CIESIN|c81db2d7-e55c-4109-8312-96b5bcaab96d"
  "iso-topic-categories|BIOTA|c3d9cf68-90b1-46be-914c-38ecb2e70097"
  "related-urls|CollectionURL > DATA SET LANDING PAGE|8826912b-c89e-4810-b446-39b98b5d937c"
  "granule-data-format (1)|ASCII|8e128326-b9cb-44c7-9e6b-4bd950a08753"
  "granule-data-format (2)|netCDF-4|30ea4e9a-4741-42c9-ad8f-f10930b35294"
  "mime-type (1)|text/html|415a10b5-7286-4195-a88e-00c7b995b7d0"
  "mime-type (2)|text/csv|2065aabb-9beb-4c84-8ad7-0e16cfed17cf"
  "instruments|AMSR-E|736038ef-c1ae-47c7-a50e-729474eeb3b1"
)

if ! command -v curl >/dev/null 2>&1; then
  echo "curl is required but not installed."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "jq is required but not installed."
  exit 1
fi

echo "Querying CMR UAT for Collection Hits by UUID..."
echo "--------------------------------------------------------"
printf "%-30s | %-38s | %-36s | %s\n" "CATEGORY" "PREF LABEL" "UUID" "HITS"
echo "--------------------------------------------------------"

# Loop through each item in the array
for ITEM in "${ITEMS[@]}"; do
  IFS='|' read -r CATEGORY PREF_LABEL UUID <<<"$ITEM"

  # Hit the CMR API. We use keyword=$UUID to ensure CMR parses it correctly.
  URL="https://cmr.uat.earthdata.nasa.gov/search/collections.umm_json?keyword=${UUID}"
  CURL_ARGS=(-sS -w $'\n%{http_code}')
  if [[ -n "${TOKEN:-}" ]]; then
    CURL_ARGS+=(-H "Authorization: Bearer $TOKEN")
  fi
  CURL_ARGS+=("$URL")

  RESPONSE="$(curl "${CURL_ARGS[@]}")"
  BODY="${RESPONSE%$'\n'*}"
  HTTP_CODE="${RESPONSE##*$'\n'}"

  if [[ "$HTTP_CODE" != "200" ]]; then
    HITS="HTTP ${HTTP_CODE}"
  else
    HITS="$(jq -r '.hits // "Error"' <<<"$BODY" 2>/dev/null || printf 'Invalid JSON')"
  fi

  printf "%-30s | %-38s | %-36s | %s\n" "$CATEGORY" "$PREF_LABEL" "$UUID" "$HITS"
done

echo "--------------------------------------------------------"
