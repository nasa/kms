#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

import {
  CreateTopicCommand,
  PublishCommand,
  SNSClient
} from '@aws-sdk/client-sns'

/**
 * Local keyword-event publisher for the metadata-correction smoke flow.
 *
 * This script reads one fixture file, extracts its keyword events, and publishes them to the
 * LocalStack SNS topic that feeds the local bridge and metadata-correction pipeline. It is
 * intentionally fixture-driven so the smoke test can replay the same sequence every time,
 * including multi-event scenarios where one correction changes what later events should see.
 *
 * In practice the flow is:
 * 1. load keyword events from the smoke fixture
 * 2. create or reuse the local keyword-events SNS topic
 * 3. publish each event in order
 * 4. optionally wait between events so the local bridge can process stateful corrections cleanly
 */
const defaultFixturePath = path.resolve(
  import.meta.dirname,
  'fixtures/metadata_correction_smoke.full_path.example.json'
)

const fixturePath = process.env.FIXTURE_FILE || process.argv[2] || defaultFixturePath
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'))
const rawKeywordEvents = fixture.keywordEvents
  || (fixture.keywordEvent ? [fixture.keywordEvent] : [])
const keywordEvents = rawKeywordEvents.map((keywordEvent) => ({
  ...keywordEvent,
  EventType: process.env.KEYWORD_EVENT_TYPE || keywordEvent.EventType,
  Timestamp: process.env.KEYWORD_EVENT_TIMESTAMP || new Date().toISOString()
}))

if (keywordEvents.length === 0) {
  throw new Error(`Fixture ${fixturePath} is missing a valid keywordEvent or keywordEvents payload.`)
}

keywordEvents.forEach((keywordEvent, index) => {
  if (!keywordEvent?.EventType || !keywordEvent?.Scheme || !keywordEvent?.UUID) {
    throw new Error(`Fixture ${fixturePath} has an invalid keyword event at index ${index}.`)
  }
})

const region = process.env.AWS_REGION || 'us-east-1'
const localstackPort = process.env.LOCALSTACK_PORT || '4566'
const endpoint = process.env.LOCALSTACK_HOST_ENDPOINT || `http://localhost:${localstackPort}`
const stackPrefix = process.env.STACK_PREFIX || 'kms'
const stageName = process.env.STAGE_NAME || 'dev'
const topicName = `${stackPrefix}-${stageName}-keyword-events`
const publishDelayMs = Number(process.env.KEYWORD_EVENT_DELAY_MS || '3000')

// Pause between fixture events so the local bridge can process stateful updates in order.
const delay = (ms) => new Promise((resolve) => {
  setTimeout(resolve, ms)
})

// Point the SNS client at LocalStack so the smoke flow can use the deployed bridge wiring locally.
const snsClient = new SNSClient({
  endpoint,
  region,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
  }
})

/**
 * Publishes the fixture's keyword events into the local keyword-events SNS topic.
 *
 * The topic is created on demand in LocalStack, then each fixture event is published in order.
 * When a publish delay is configured, the script waits between events so later events can observe
 * collection changes made by earlier corrections during the same smoke run.
 *
 * @returns {Promise<void>}
 */
const main = async () => {
  const { TopicArn: topicArn } = await snsClient.send(new CreateTopicCommand({
    Name: topicName
  }))

  // Chain publishes serially so multi-event smoke fixtures stay deterministic.
  await keywordEvents.reduce(
    (publishChain, keywordEvent, index) => publishChain.then(async () => {
      const response = await snsClient.send(new PublishCommand({
        TopicArn: topicArn,
        Message: JSON.stringify(keywordEvent)
      }))

      console.log(
        '[publish-keyword-event-local] Published keyword event '
        + `eventType=${keywordEvent.EventType} `
        + `scheme=${keywordEvent.Scheme} `
        + `uuid=${keywordEvent.UUID} `
        + `messageId=${response.MessageId || 'n/a'} `
        + `topicArn=${topicArn}`
      )

      if (publishDelayMs > 0 && index < keywordEvents.length - 1) {
        console.log(
          `[publish-keyword-event-local] Waiting ${publishDelayMs}ms before next fixture event`
        )

        await delay(publishDelayMs)
      }
    }),
    Promise.resolve()
  )
}

main().catch((error) => {
  console.error('[publish-keyword-event-local] Failed to publish keyword event', error)
  process.exitCode = 1
})
