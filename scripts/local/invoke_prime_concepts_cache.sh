#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
# shellcheck source=bin/env/local_env.sh
source "${ROOT_DIR}/bin/env/local_env.sh"

TEMPLATE_FILE="${TEMPLATE_FILE:-${ROOT_DIR}/cdk/cdk.out/KmsStack.template.json}"
EVENT_FILE="${EVENT_FILE:-/tmp/prime-concepts-cache-event.json}"
LOG_FILE="${LOG_FILE:-/tmp/prime-concepts-cache.log}"
SAM_INVOKE_IMAGE="${SAM_INVOKE_IMAGE:-public.ecr.aws/lambda/nodejs:22-rapid-x86_64}"

echo "Synthesizing local template with REDIS_ENABLED=${REDIS_ENABLED}, REDIS_HOST=${REDIS_HOST}, REDIS_PORT=${REDIS_PORT}"
(
  cd "${ROOT_DIR}/cdk"
  REDIS_ENABLED="${REDIS_ENABLED}" \
  REDIS_HOST="${REDIS_HOST}" \
  REDIS_PORT="${REDIS_PORT}" \
  RDF4J_SERVICE_URL="${RDF4J_SERVICE_URL}" \
  npx cdk synth --context useLocalstack=true --output ./cdk.out >/dev/null 2>&1
)

if [[ ! -f "${TEMPLATE_FILE}" ]]; then
  echo "Template not found at ${TEMPLATE_FILE}. Run npm run start-local at least once."
  exit 1
fi

if [[ ! -f "${EVENT_FILE}" ]]; then
  cat > "${EVENT_FILE}" <<'JSON'
{"version":"published"}
JSON
fi

LOGICAL_ID="$(node -e "
const fs = require('node:fs')
const template = JSON.parse(fs.readFileSync(process.argv[1], 'utf8'))
const resources = template.Resources || {}
const entry = Object.entries(resources).find(([, res]) =>
  res?.Type === 'AWS::Lambda::Function'
  && res?.Properties?.FunctionName === 'kms-prime-concepts-cache')
if (!entry) process.exit(1)
process.stdout.write(entry[0])
" "${TEMPLATE_FILE}")"

if [[ -z "${LOGICAL_ID}" ]]; then
  echo "Could not find logical ID for FunctionName='kms-prime-concepts-cache' in ${TEMPLATE_FILE}"
  exit 1
fi

echo "Invoking ${LOGICAL_ID} with event ${EVENT_FILE}"
echo "SAM log file: ${LOG_FILE}"

rm -f "${LOG_FILE}"
touch "${LOG_FILE}"
tail -n +1 -f "${LOG_FILE}" &
TAIL_PID=$!
cleanup() {
  kill "${TAIL_PID}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

sam local invoke \
  -t "${TEMPLATE_FILE}" \
  --docker-network "${KMS_DOCKER_NETWORK}" \
  --skip-pull-image \
  --invoke-image "${SAM_INVOKE_IMAGE}" \
  --log-file "${LOG_FILE}" \
  "${LOGICAL_ID}" \
  -e "${EVENT_FILE}"
