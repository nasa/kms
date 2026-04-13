#!/usr/bin/env bash

set -euo pipefail

API_BASE_URL="${API_BASE_URL:-http://127.0.0.1:3013}"
VERSION="${VERSION:-draft}"
SCHEME_ID="${SCHEME_ID:-sciencekeywords}"
BROADER_ID="${BROADER_ID:-1eb0ea0a-312c-4d74-8d42-6f1ad758f999}"
LABEL_PREFIX="${LABEL_PREFIX:-LOCAL TEST KEYWORD}"
TIMESTAMP_SUFFIX="$(date +%s)"
CONCEPT_ID="$(uuidgen | tr '[:upper:]' '[:lower:]')"
PREF_LABEL="${LABEL_PREFIX} ${TIMESTAMP_SUFFIX}"
REFERENCE_URL="${REFERENCE_URL:-https://example.com/local-test-keyword}"
DEFINITION_TEXT="${DEFINITION_TEXT:-Local test keyword created for publish verification ${TIMESTAMP_SUFFIX}}"

read -r -d '' RDF_XML <<EOF || true
<rdf:RDF
  xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
  xmlns:skos="http://www.w3.org/2004/02/skos/core#"
  xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xml:base="https://gcmd.earthdata.nasa.gov/kms/concept/">
  <skos:Concept rdf:about="${CONCEPT_ID}">
    <skos:prefLabel xml:lang="en">${PREF_LABEL}</skos:prefLabel>
    <skos:definition xml:lang="en">${DEFINITION_TEXT}</skos:definition>
    <gcmd:reference gcmd:text="${REFERENCE_URL}" xml:lang="en"/>
    <skos:inScheme rdf:resource="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${SCHEME_ID}"/>
    <skos:broader rdf:resource="${BROADER_ID}"/>
  </skos:Concept>
</rdf:RDF>
EOF

echo "Creating keyword:"
echo "  conceptId: ${CONCEPT_ID}"
echo "  prefLabel: ${PREF_LABEL}"
echo "  scheme: ${SCHEME_ID}"
echo "  broader: ${BROADER_ID}"

curl \
  --fail \
  --silent \
  --show-error \
  -X POST "${API_BASE_URL}/concept?version=${VERSION}" \
  -H 'Content-Type: application/rdf+xml' \
  --data-binary "${RDF_XML}"

echo
