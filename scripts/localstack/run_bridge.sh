#!/usr/bin/env bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/../.." && pwd)"

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
