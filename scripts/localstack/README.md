# LocalStack Bridge

This directory contains the local bridge that connects LocalStack-managed event services back into the real KMS handlers running locally through SAM.

## Why This Exists

Local development splits responsibilities across a few tools:

- SAM runs the API Gateway and Lambda handlers locally.
- LocalStack emulates AWS-managed messaging services such as EventBridge, SNS, and SQS.
- RDF4J and Redis run as separate local services.

In AWS, EventBridge and SQS can invoke Lambda for us. `sam local start-api` does not emulate those integrations end to end for this repo, so this bridge fills that gap by:

- provisioning the needed LocalStack resources
- polling LocalStack queues
- invoking the matching local handler

## Usage

The normal path is:

```bash
npm run start-local
```

That starts both:

- the SAM local API
- the LocalStack bridge runner from [run_bridge.sh](/Users/cgokey/Developer/nasa/kms/scripts/localstack/run_bridge.sh)

You can also run the bridge by itself:

```bash
bash scripts/localstack/run_bridge.sh
```

## Registry

The bridge registry is supplied by `run_bridge.sh` through `BRIDGE_REGISTRY_JSON`.

Each registry entry describes:

| Field | Description |
| --- | --- |
| `handler` | Handler name under `serverless/src/<handler>/handler.js` |
| `sourceType` | `eventbridge-to-sqs` or `sns-to-sqs` |
| `eventPattern` | For EventBridge, use `source` and optional `detailType`. For SNS, use `topicName`. |

Example:

```json
{
  "handler": "publisher",
  "sourceType": "eventbridge-to-sqs",
  "eventPattern": {
    "source": ["kms.publish"],
    "detailType": ["kms.published.version.changed"]
  }
}
```

Current default flows are:

- `kms.publish` -> `publisher`
- `kms.publisher` -> `primeConceptsCache`
- `keyword-events` -> `cmrKeywordEventsListener`

To add another bridged flow, add another registry entry in [run_bridge.sh](/Users/cgokey/Developer/nasa/kms/scripts/localstack/run_bridge.sh) and restart `npm run start-local`.
