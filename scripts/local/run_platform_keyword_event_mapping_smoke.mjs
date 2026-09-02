#!/usr/bin/env node

import assert from 'node:assert/strict'

import {
  compareKeywordCsvContent,
  createKeywordEvents
} from '../../serverless/src/shared/redis-path-store/getPublishKeywordEvents'

/**
 * Verifies platform publisher events keep Short_Name and Long_Name in their correct object fields
 * for both a forward keyword change and its revert.
 *
 * Run with:
 *   npx vite-node --config vite.config.js scripts/local/run_platform_keyword_event_mapping_smoke.mjs
 */

const keywordUuid = 'f1ccca0a-30c2-4d22-8b78-a1a36b8901b3'
const defaultLongName = 'Greenhouse Gases Observing Satellite'

const createPlatformsCsv = (shortName, longName = defaultLongName) => [
  '"Keyword Version: smoke"',
  '"Category","Class","Type","Short_Name","Long_Name","UUID"',
  `"Platforms","Space-based Platforms","Earth Observation Satellites","${shortName}","${longName}","${keywordUuid}"`
].join('\n')

const buildExpectedKeywordObject = (shortName, longName = defaultLongName) => ({
  Category: 'Platforms',
  Class: 'Space-based Platforms',
  Type: 'Earth Observation Satellites',
  ShortName: shortName,
  LongName: longName
})

const transitions = [
  {
    versionName: 'local-amazonia-regression',
    oldShortName: 'Amazonia-1',
    newShortName: 'Amazonia-1-Test',
    longName: 'Amazonia-1'
  },
  {
    versionName: 'local-keyword-republish-v1',
    oldShortName: 'GOSAT',
    newShortName: 'GOSAT - Test1'
  },
  {
    versionName: 'local-keyword-republish-v2',
    oldShortName: 'GOSAT - Test1',
    newShortName: 'GOSAT'
  }
]

const results = transitions.map((transition) => {
  const comparison = compareKeywordCsvContent({
    oldCsvContent: createPlatformsCsv(transition.oldShortName, transition.longName),
    newCsvContent: createPlatformsCsv(transition.newShortName, transition.longName),
    scheme: 'platforms'
  })
  const events = createKeywordEvents(new Map([
    ['platforms', comparison]
  ]))

  assert.equal(events.length, 1)

  const [keywordEvent] = events
  const expectedOldKeywordObject = buildExpectedKeywordObject(
    transition.oldShortName,
    transition.longName
  )
  const expectedNewKeywordObject = buildExpectedKeywordObject(
    transition.newShortName,
    transition.longName
  )

  assert.equal(keywordEvent.EventType, 'UPDATED')
  assert.equal(keywordEvent.UUID, keywordUuid)
  assert.deepEqual(keywordEvent.OldKeywordObject, expectedOldKeywordObject)
  assert.deepEqual(keywordEvent.NewKeywordObject, expectedNewKeywordObject)

  return {
    ...transition,
    oldKeywordObject: keywordEvent.OldKeywordObject,
    newKeywordObject: keywordEvent.NewKeywordObject
  }
})

console.log('[platform-keyword-event-mapping-smoke] Completed successfully')
console.log(JSON.stringify({
  keywordUuid,
  results
}, null, 2))
