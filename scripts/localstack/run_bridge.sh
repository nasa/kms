#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

# Default local topic ARN: arn:aws:sns:us-east-1:000000000000:kms-dev-metadata-correction-requests.fifo
export METADATA_CORRECTION_REQUESTS_TOPIC_ARN="${METADATA_CORRECTION_REQUESTS_TOPIC_ARN:-arn:aws:sns:${AWS_REGION:-us-east-1}:${LOCALSTACK_ACCOUNT_ID:-000000000000}:${STACK_PREFIX:-kms}-${STAGE_NAME:-dev}-metadata-correction-requests.fifo}"

export BRIDGE_REGISTRY_JSON="${BRIDGE_REGISTRY_JSON:-$(cat <<'EOF'
[
  {
    "handler": "publisher",
    "sourceType": "eventbridge-to-sqs",
    "eventPattern": {
      "source": ["kms.publish"],
      "detailType": ["kms.published.version.changed"]
    }
  },
  {
    "handler": "cmrKeywordEventsListener",
    "sourceType": "sns-to-sqs",
    "eventPattern": {
      "topicName": "keyword-events"
    }
  },
  {
    "handler": "metadataCorrectionService",
    "sourceType": "sns-to-sqs",
    "eventPattern": {
      "fifo": true,
      "rawMessageDelivery": true,
      "topicName": "metadata-correction-requests"
    }
  },
  {
    "handler": "primeConceptsCache",
    "sourceType": "eventbridge-to-sqs",
    "eventPattern": {
      "source": ["kms.publisher"],
      "detailType": ["kms.publisher.analysis.completed"]
    }
  }
]
EOF
)}"

vite-node --config "${PROJECT_ROOT}/vite.config.js" "${SCRIPT_DIR}/bridge.js"
