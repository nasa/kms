#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'

import { PublishCommand, SNSClient } from '@aws-sdk/client-sns'
import { GetParameterCommand, SSMClient } from '@aws-sdk/client-ssm'
import { mockClient } from 'aws-sdk-client-mock'

/**
 * Local provider-gating smoke for the CMR keyword events listener.
 *
 * This script exercises the real cmrKeywordEventsListener handler against the local mock CMR
 * server, with the outbound SNS publish and the CMR system-token SSM lookup both mocked
 * in-process (via aws-sdk-client-mock) instead of routed through LocalStack/AWS. That keeps this
 * smoke fully self-contained: no LocalStack, SAM, Redis, DocumentDB, or RDF4J required.
 *
 * The fixture maps one keyword UUID to two collections from two different providers. The script
 * runs the listener twice, flipping which provider is enabled each time, and asserts that only
 * the enabled provider's collection concept id is ever published toward the metadata-correction
 * queue -- the disabled provider's collection must be skipped and logged, never queued.
 *
 * Run with:
 *   npx vite-node --config vite.config.js scripts/local/run_cmr_keyword_events_listener_provider_gating_smoke.mjs
 */
const rootDir = path.resolve(import.meta.dirname, '../..')
const fixturePath = path.resolve(
  rootDir,
  'scripts/local/fixtures/cmr_keyword_events_listener.provider_gating.example.json'
)
const port = Number(process.env.MOCK_CMR_PORT || 3021)
const baseUrl = process.env.CMR_BASE_URL || `http://127.0.0.1:${port}`

const fixture = JSON.parse(await fs.readFile(fixturePath, 'utf8'))
const [enabledCollection, disabledCollection] = fixture.cmr.collections
const { keywordEvent } = fixture

const sleep = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

const waitForHealth = async (healthUrl, attempt = 1) => {
  try {
    const response = await fetch(healthUrl)

    if (response.ok) {
      return
    }
  } catch {
    // Keep polling until the child server comes up.
  }

  if (attempt >= 40) {
    throw new Error(`Timed out waiting for mock CMR health endpoint: ${healthUrl}`)
  }

  await sleep(250)
  await waitForHealth(healthUrl, attempt + 1)
}

const buildSqsRecord = (messageId) => ({
  messageId,
  body: JSON.stringify({
    Type: 'Notification',
    MessageId: `sns-${messageId}`,
    Message: JSON.stringify(keywordEvent)
  })
})

// Pulls the collectionConceptId out of each mocked SNS PublishCommand call.
const getPublishedCollectionConceptIds = (snsMock) => snsMock.commandCalls(PublishCommand)
  .map((call) => JSON.parse(call.args[0].input.Message).collectionConceptId)

let mockServerProcess

try {
  mockServerProcess = spawn(
    process.execPath,
    [path.resolve(rootDir, 'scripts/local/mock_cmr_server.mjs'), fixturePath],
    {
      env: {
        ...process.env,
        FIXTURE_FILE: fixturePath,
        MOCK_CMR_PORT: String(port)
      },
      stdio: 'inherit'
    }
  )

  await waitForHealth(`${baseUrl}/health`)

  process.env.CMR_BASE_URL = baseUrl
  process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME = process.env.CMR_SYSTEM_TOKEN_PARAMETER_NAME
    || '/local/smoke/cmr-system-token'

  const topicEnvVar = 'METADATA_CORRECTION_REQUESTS_TOPIC_ARN'
  const defaultTopicArn = 'arn:aws:sns:us-east-1:000000000000:kms-local-metadata-correction-requests.fifo'

  process.env[topicEnvVar] = process.env[topicEnvVar] || defaultTopicArn

  const { cmrKeywordEventsListener } = await import('../../serverless/src/cmrKeywordEventsListener/handler')

  // Mock the CMR system-token SSM lookup so the listener's real CMR collection search can
  // proceed with a fake authorization value, without needing a reachable AWS/LocalStack SSM.
  mockClient(SSMClient).on(GetParameterCommand).resolves({
    Parameter: { Value: 'local-system-token' }
  })

  const snsMock = mockClient(SNSClient)
  snsMock.on(PublishCommand).resolves({ MessageId: 'mock-message-id' })

  // Pass 1: only the first collection's provider is enabled.
  process.env.CMR_WRITEBACK_PROVIDERS = enabledCollection.providerId

  await cmrKeywordEventsListener({
    Records: [buildSqsRecord('provider-gating-smoke-pass-1')]
  })

  const pass1PublishedIds = getPublishedCollectionConceptIds(snsMock)

  if (pass1PublishedIds.length !== 1 || pass1PublishedIds[0] !== enabledCollection.conceptId) {
    throw new Error(
      `Pass 1 expected only ${enabledCollection.conceptId} to publish, got: ${JSON.stringify(pass1PublishedIds)}`
    )
  }

  // Pass 2: flip which provider is enabled, to prove the gate isn't hardcoded either way.
  snsMock.reset()
  snsMock.on(PublishCommand).resolves({ MessageId: 'mock-message-id' })
  process.env.CMR_WRITEBACK_PROVIDERS = disabledCollection.providerId

  await cmrKeywordEventsListener({
    Records: [buildSqsRecord('provider-gating-smoke-pass-2')]
  })

  const pass2PublishedIds = getPublishedCollectionConceptIds(snsMock)

  if (pass2PublishedIds.length !== 1 || pass2PublishedIds[0] !== disabledCollection.conceptId) {
    throw new Error(
      `Pass 2 expected only ${disabledCollection.conceptId} to publish, got: ${JSON.stringify(pass2PublishedIds)}`
    )
  }

  console.log('[cmr-keyword-events-listener-provider-gating-smoke] Completed successfully')
  console.log(JSON.stringify({
    pass1: {
      enabledProvider: enabledCollection.providerId,
      publishedCollectionConceptIds: pass1PublishedIds
    },
    pass2: {
      enabledProvider: disabledCollection.providerId,
      publishedCollectionConceptIds: pass2PublishedIds
    }
  }, null, 2))

  snsMock.restore()
} finally {
  if (mockServerProcess) {
    mockServerProcess.kill('SIGTERM')
  }
}
