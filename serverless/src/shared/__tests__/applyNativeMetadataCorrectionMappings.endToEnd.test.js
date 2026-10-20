/**
 * Verifies the metadata-correction fixture contracts:
 * 1. Publishing diffs the published and draft CSVs into keyword events and Redis entries.
 * 2. The keyword-event consumer turns those events into collection-scoped correction requests.
 * 3. The metadata-correction service resolves four CMR-translated UMM-C records into corrections.
 * 4. Ambiguous keyword values remain unchanged in the corrected native metadata.
 * 5. Complete update fixtures produce the expected metadata for every native format.
 * 6. Complete deletion fixtures produce the expected metadata for every native format.
 */
import { readdirSync, readFileSync } from 'fs'
import { join } from 'path'

import {
  afterAll,
  beforeAll,
  describe,
  expect,
  test,
  vi
} from 'vitest'

import { cmrKeywordEventsListener } from '@/cmrKeywordEventsListener/handler'
import { metadataCorrectionService } from '@/metadataCorrectionService/handler'
import { emitConsumerMetricsSafely } from '@/shared/emitConsumerMetricsSafely'
import { getCmrCollectionConceptIds } from '@/shared/getCmrCollectionConceptIds'
import { getCmrCollectionNativeMetadata } from '@/shared/getCmrCollectionNativeMetadata'
import { getCmrCollectionUmmDetails } from '@/shared/getCmrCollectionUmmDetails'
import { persistMetadataCorrectionAuditLog } from '@/shared/persistMetadataCorrectionAuditLog'
import { publishMetadataCorrectionRequest } from '@/shared/publishMetadataCorrectionRequest'
import { writeCorrectedMetadataToCmr } from '@/shared/writeCorrectedMetadataToCmr'

import { invokeMetadataCorrectionDelegate } from '../invokeMetadataCorrectionDelegate'
import {
  compareKeywordCsvContent,
  createKeywordEvents
} from '../redis-path-store/getPublishKeywordEvents'
import { buildCacheEntries } from '../redis-path-store/helpers/buildCacheEntries'
import {
  HISTORICAL_CACHE_FULL_PATH_SCHEME_SET,
  HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET,
  PUBLISHED_CACHE_FULL_PATH_SCHEME_SET,
  PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET
} from '../redis-path-store/helpers/constants'
import {
  createShortNameConceptResponseBody
} from '../redis-path-store/helpers/createShortNameConceptResponseBody'
import {
  parseFullPathCsvRecords,
  parseShortNameCsvRecords
} from '../redis-path-store/helpers/keywordCsv'
import { normalizeKeywordScheme } from '../redis-path-store/helpers/normalizeKeywordScheme'
import {
  createConceptResponseCacheKeyByFullPath,
  createConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByUuid
} from '../redisCacheKeys'
import { getCachedJsonResponse, getRedisClient } from '../redisCacheStore'

vi.mock('@/shared/emitConsumerMetricsSafely', () => ({
  emitConsumerMetricsSafely: vi.fn()
}))

vi.mock('@/shared/getCmrCollectionConceptIds', () => ({
  getCmrCollectionConceptIds: vi.fn()
}))

vi.mock('@/shared/getCmrCollectionNativeMetadata', () => ({
  getCmrCollectionNativeMetadata: vi.fn()
}))

vi.mock('@/shared/getCmrCollectionUmmDetails', () => ({
  getCmrCollectionUmmDetails: vi.fn()
}))

vi.mock('@/shared/logger', () => ({
  logger: {
    debug: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn()
  }
}))

vi.mock('@/shared/persistMetadataCorrectionAuditLog', () => ({
  persistMetadataCorrectionAuditLog: vi.fn()
}))

vi.mock('@/shared/publishMetadataCorrectionRequest', () => ({
  publishMetadataCorrectionRequest: vi.fn()
}))

vi.mock('@/shared/writeCorrectedMetadataToCmr', () => ({
  writeCorrectedMetadataToCmr: vi.fn()
}))

vi.mock('../redisCacheStore', async (importOriginal) => ({
  ...await importOriginal(),
  getCachedJsonResponse: vi.fn(),
  getRedisClient: vi.fn()
}))

vi.mock('../invokeMetadataCorrectionDelegate', async (importOriginal) => {
  const actual = await importOriginal()

  return {
    ...actual,
    invokeMetadataCorrectionDelegate: vi.fn(actual.invokeMetadataCorrectionDelegate)
  }
})

const fixtureDirectory = join(
  __dirname,
  '../__mocks__/native_metadata_correction_mappings/end_to_end'
)
const generatedFixtureDirectory = join(fixtureDirectory, 'generated')

const readFixture = (filename) => readFileSync(join(fixtureDirectory, filename), 'utf-8')
const readJsonFixture = (filename) => JSON.parse(readFixture(filename))
const readGeneratedCsv = ({
  scheme,
  version
}) => readFixture(`generated/${scheme}/${version}.csv`)

// Compare the resolved service output using the same logical fields stored in correction fixtures.
const normalizeFixtureCorrection = (correction) => {
  const normalizeKeywordObject = (keywordObject = {}) => Object.fromEntries(
    Object.entries(keywordObject).filter(([key]) => ![
      'DataCenterURL',
      'LongName'
    ].includes(key))
  )
  const normalizedCorrection = {
    scheme: normalizeKeywordScheme(correction.scheme),
    action: correction.action,
    oldKeywordObject: normalizeKeywordObject(correction.oldKeywordObject)
  }

  if (correction.action === 'replace') {
    normalizedCorrection.newKeywordObject = normalizeKeywordObject(
      correction.newKeywordObject
    )
  }

  if (correction.newLongName) {
    normalizedCorrection.newLongName = correction.newLongName
  }

  return normalizedCorrection
}

/**
 * Builds a Redis-shaped Map from the existing generated CSV fixtures.
 *
 * The published CSVs become historical lookup entries. The draft CSVs represent the next
 * published version and become current path, short-name, and UUID entries. This uses the same
 * parsers, ambiguity filtering, response bodies, and key builders as production cache creation.
 *
 * @returns {Map<string, Object>} Redis keys mapped to parsed cached HTTP responses.
 */
const buildConceptCacheFromCsv = () => {
  const conceptCache = new Map()
  const schemes = readdirSync(generatedFixtureDirectory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map(({ name }) => normalizeKeywordScheme(name))
    .sort()

  schemes.forEach((scheme) => {
    [
      {
        cacheType: 'historical',
        csvContent: readGeneratedCsv({
          scheme,
          version: 'published'
        }),
        fullPathSchemes: HISTORICAL_CACHE_FULL_PATH_SCHEME_SET,
        shortNameSchemes: HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET,
        createFullPathCacheKey: createConceptResponseCacheKeyByFullPath,
        createShortNameCacheKey: createConceptResponseCacheKeyByShortName
      },
      {
        cacheType: 'published',
        csvContent: readGeneratedCsv({
          scheme,
          version: 'draft'
        }),
        fullPathSchemes: PUBLISHED_CACHE_FULL_PATH_SCHEME_SET,
        shortNameSchemes: PUBLISHED_CACHE_SHORT_NAME_SCHEME_SET,
        createFullPathCacheKey: createPublishedConceptResponseCacheKeyByFullPath,
        createShortNameCacheKey: createPublishedConceptResponseCacheKeyByShortName
      }
    ].forEach((configuration) => {
      const {
        cacheType,
        createFullPathCacheKey,
        createShortNameCacheKey,
        csvContent,
        fullPathSchemes,
        shortNameSchemes
      } = configuration
      const isPublished = cacheType === 'published'
      const createUuidCacheKey = isPublished
        ? (uuid) => createPublishedConceptResponseCacheKeyByUuid({
          uuid,
          scheme
        })
        : undefined
      let cacheEntries = []

      if (fullPathSchemes.has(scheme)) {
        cacheEntries = buildCacheEntries({
          records: parseFullPathCsvRecords({
            csvContent,
            scheme
          }),
          createCacheKey: (fullPath) => createFullPathCacheKey({
            fullPath: fullPath.toLowerCase(),
            scheme
          }),
          createResponseBody: (fullPath, uuid) => ({
            uuid,
            fullPath
          }),
          createUuidCacheKey
        })
      } else if (shortNameSchemes.has(scheme)) {
        cacheEntries = buildCacheEntries({
          records: parseShortNameCsvRecords({
            csvContent,
            scheme
          }),
          createCacheKey: (shortName) => createShortNameCacheKey({
            shortName: shortName.toLowerCase(),
            scheme
          }),
          createResponseBody: (_shortName, concept) => (
            createShortNameConceptResponseBody(concept)
          ),
          createUuidCacheKey
        })
      }

      cacheEntries.forEach(({ key, value }) => {
        conceptCache.set(key, JSON.parse(value))
      })
    })
  })

  return conceptCache
}

describe('when running the metadata correction workflow end to end', () => {
  const dif10CollectionConceptId = 'C1234567890-LOCAL'
  const dif10NativeId = 'end-to-end-dif10-record'
  const echo10NativeId = 'end-to-end-echo10-record'
  const iso19115CollectionConceptId = 'C1234567222-LOCAL'
  const iso19115NativeId = 'end-to-end-iso19115-record'
  const isoSmapCollectionConceptId = 'C1234567223-LOCAL'
  const isoSmapNativeId = 'end-to-end-isosmap-record'
  const ummcCollectionConceptId = 'C1234567855-LOCAL'
  const ummcNativeId = 'end-to-end-ummc-record'
  const providerId = 'LOCAL'
  const collectionConceptIds = [
    ummcCollectionConceptId,
    dif10CollectionConceptId,
    iso19115CollectionConceptId,
    isoSmapCollectionConceptId
  ]
  let keywordEvents
  let metadataCorrectionRequests

  beforeAll(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-10-15T12:00:00.000Z'))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

  describe('when the publisher creates a new keyword version', () => {
    let keywordChanges

    // Diff every published/draft CSV pair and build the historical/current Redis namespaces.
    beforeAll(() => {
      const schemes = readdirSync(generatedFixtureDirectory, { withFileTypes: true })
        .filter((entry) => entry.isDirectory())
        .map(({ name }) => normalizeKeywordScheme(name))
        .sort()

      keywordChanges = new Map(schemes.map((scheme) => [
        scheme,
        compareKeywordCsvContent({
          oldCsvContent: readGeneratedCsv({
            scheme,
            version: 'published'
          }),
          newCsvContent: readGeneratedCsv({
            scheme,
            version: 'draft'
          }),
          scheme
        })
      ]))

      const conceptCache = buildConceptCacheFromCsv()

      keywordEvents = createKeywordEvents(keywordChanges)
      vi.mocked(getRedisClient).mockResolvedValue(conceptCache)
      vi.mocked(getCachedJsonResponse).mockImplementation(async ({ cacheKey }) => (
        conceptCache.get(cacheKey)
      ))
    })

    test('should compare published and draft CSV fixtures and generate the expected keyword events', () => {
      const expectedShortNameEvents = readJsonFixture('generated/short-name-events.json')
      const expectedShortNameEventUuids = new Set(
        expectedShortNameEvents.map(({ UUID }) => UUID)
      )
      const actualShortNameEvents = keywordEvents
        .filter(({ UUID }) => expectedShortNameEventUuids.has(UUID))
        .map(({
          EventType,
          Scheme,
          UUID,
          OldKeywordObject,
          NewKeywordObject
        }) => ({
          EventType,
          Scheme,
          UUID,
          OldKeywordObject,
          NewKeywordObject
        }))

      const expectedEventCounts = {
        INSERTED: 0,
        UPDATED: 0,
        DELETED: 0
      }
      keywordChanges.forEach(({
        addedKeywords,
        changedKeywords,
        removedKeywords
      }) => {
        expectedEventCounts.INSERTED += addedKeywords.size
        expectedEventCounts.UPDATED += changedKeywords.size
        expectedEventCounts.DELETED += removedKeywords.size
      })

      const actualEventCounts = {
        INSERTED: 0,
        UPDATED: 0,
        DELETED: 0
      }
      keywordEvents.forEach(({ EventType }) => {
        actualEventCounts[EventType] += 1
      })

      expect(actualEventCounts).toEqual(expectedEventCounts)
      expect([...new Set(keywordEvents.map(({ Scheme }) => Scheme))]).toEqual([
        'chronounits',
        'dataformat',
        'horizontalresolutionrange',
        'idnnode',
        'instruments',
        'isotopiccategory',
        'locations',
        'platforms',
        'productlevelid',
        'projects',
        'providers',
        'rucontenttype',
        'sciencekeywords',
        'verticalresolutionrange'
      ])

      expect(actualShortNameEvents).toEqual(expectedShortNameEvents)
    })

    describe('when the keyword-event consumer processes the generated events', () => {
      beforeAll(async () => {
        vi.mocked(getCmrCollectionConceptIds).mockResolvedValue(
          collectionConceptIds
        )

        vi.mocked(publishMetadataCorrectionRequest).mockImplementation(async () => ({
          messageId: 'metadata-correction-request',
          topicArn: 'metadata-correction-topic'
        }))

        await cmrKeywordEventsListener({
          Records: keywordEvents.map((keywordEvent, index) => ({
            messageId: `keyword-event-${index + 1}`,
            body: JSON.stringify({
              MessageId: `published-keyword-event-${index + 1}`,
              Message: JSON.stringify({
                ...keywordEvent,
                VersionName: 'Draft'
              })
            })
          }))
        })

        metadataCorrectionRequests = vi.mocked(publishMetadataCorrectionRequest).mock.calls
          .map(([metadataCorrectionRequest]) => metadataCorrectionRequest)
      })

      test('should publish one collection correction request for every generated event', () => {
        expect(publishMetadataCorrectionRequest).toHaveBeenCalledTimes(
          keywordEvents.length * collectionConceptIds.length
        )
      })

      describe('when the metadata-correction service processes requests by native format', () => {
        beforeAll(async () => {
          vi.mocked(persistMetadataCorrectionAuditLog).mockImplementation(async ({
            runId = 'end-to-end-run',
            status
          }) => ({
            runId,
            status,
            created: status === 'checked'
          }))

          vi.mocked(writeCorrectedMetadataToCmr).mockResolvedValue({
            ingestResult: {
              enabled: false,
              updated: false
            }
          })

          vi.mocked(emitConsumerMetricsSafely).mockResolvedValue(undefined)

          const actualDelegate = await vi.importActual('../invokeMetadataCorrectionDelegate')

          vi.mocked(invokeMetadataCorrectionDelegate)
            .mockImplementation(actualDelegate.invokeMetadataCorrectionDelegate)
        })

        describe('when the metadata-correction service processes the UMM-C collection', () => {
          let metadataCorrectionDelegateRequest
          let translatedUmmRecord

          beforeAll(async () => {
            translatedUmmRecord = readJsonFixture('metadata-correction.umm.before.json')
            vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
              collectionConceptId: ummcCollectionConceptId,
              providerId,
              nativeId: ummcNativeId,
              revisionId: 1,
              format: 'application/vnd.nasa.cmr.umm+json;version=1.18.4',
              umm: structuredClone(translatedUmmRecord)
            })

            vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue({
              metadataPayload: structuredClone(translatedUmmRecord),
              contentType: 'application/vnd.nasa.cmr.umm+json;version=1.18.4'
            })

            vi.mocked(invokeMetadataCorrectionDelegate).mockClear()
            vi.mocked(writeCorrectedMetadataToCmr).mockClear()

            const metadataCorrectionRequest = metadataCorrectionRequests.find((request) => (
              request.collectionConceptId === ummcCollectionConceptId
              && request.keywordEvent.eventType === 'UPDATED'
            ))

            await metadataCorrectionService({
              Records: [{
                messageId: 'end-to-end-ummc-run',
                body: JSON.stringify(metadataCorrectionRequest)
              }]
            })

            metadataCorrectionDelegateRequest = vi.mocked(invokeMetadataCorrectionDelegate)
              .mock.calls.at(0).at(0)
          })

          test('should send the expected corrections to the native metadata delegate', () => {
            const expectedCorrections = readJsonFixture('updates/ummc.corrections.json')
              .corrections
              .map(normalizeFixtureCorrection)
            const actualCorrections = metadataCorrectionDelegateRequest.corrections
              .map(normalizeFixtureCorrection)

            expect(metadataCorrectionDelegateRequest).toMatchObject({
              collectionConceptId: ummcCollectionConceptId,
              providerId,
              nativeId: ummcNativeId,
              nativeFormat: 'UMM',
              metadataPayload: translatedUmmRecord
            })

            expect(actualCorrections).toEqual(expect.arrayContaining(expectedCorrections))
            expect(actualCorrections).toHaveLength(expectedCorrections.length)
          })

          test('should send the expected corrected metadata to CMR', () => {
            expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith(expect.objectContaining({
              collectionConceptId: ummcCollectionConceptId,
              providerId,
              nativeId: ummcNativeId,
              nativeFormat: 'UMM',
              correctedMetadata: JSON.stringify(
                readJsonFixture('metadata-correction.umm.after.json'),
                null,
                2
              )
            }))
          })
        })

        describe('when the metadata-correction service processes the DIF10 collection', () => {
          beforeAll(async () => {
            vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
              collectionConceptId: dif10CollectionConceptId,
              providerId,
              nativeId: dif10NativeId,
              revisionId: 1,
              format: 'application/dif10+xml',
              umm: readJsonFixture('dif10.validation.umm.json')
            })

            vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue(
              readFixture('dif10.before.xml')
            )

            vi.mocked(writeCorrectedMetadataToCmr).mockClear()

            const metadataCorrectionRequest = metadataCorrectionRequests.find((request) => (
              request.collectionConceptId === dif10CollectionConceptId
              && request.keywordEvent.eventType === 'UPDATED'
            ))

            await metadataCorrectionService({
              Records: [{
                messageId: 'end-to-end-dif10-run',
                body: JSON.stringify(metadataCorrectionRequest)
              }]
            })
          })

          test('should send the expected corrected metadata to CMR', () => {
            expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith(expect.objectContaining({
              collectionConceptId: dif10CollectionConceptId,
              providerId,
              nativeId: dif10NativeId,
              nativeFormat: 'DIF10',
              correctedMetadata: readFixture('metadata-correction.dif10.after.xml').trimEnd()
            }))
          })
        })

        describe('when the metadata-correction service processes the ECHO10 collection', () => {
          beforeAll(async () => {
            vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
              collectionConceptId: dif10CollectionConceptId,
              providerId,
              nativeId: echo10NativeId,
              revisionId: 1,
              format: 'application/echo10+xml',
              umm: readJsonFixture('echo10.validation.umm.json')
            })

            vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue(
              readFixture('echo10.before.xml')
            )

            vi.mocked(writeCorrectedMetadataToCmr).mockClear()

            const metadataCorrectionRequest = metadataCorrectionRequests.find((request) => (
              request.collectionConceptId === dif10CollectionConceptId
              && request.keywordEvent.eventType === 'UPDATED'
            ))

            await metadataCorrectionService({
              Records: [{
                messageId: 'end-to-end-echo10-run',
                body: JSON.stringify(metadataCorrectionRequest)
              }]
            })
          })

          test('should send the expected corrected metadata to CMR', () => {
            expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith(expect.objectContaining({
              collectionConceptId: dif10CollectionConceptId,
              providerId,
              nativeId: echo10NativeId,
              nativeFormat: 'ECHO10',
              correctedMetadata: readFixture('updates/echo10.after.xml').trimEnd()
            }))
          })

          describe('when a keyword value maps to multiple concept UUIDs', () => {
            test('should preserve the existing keyword in the corrected metadata', () => {
              expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith(expect.objectContaining({
                correctedMetadata: expect.stringContaining(
                  '<ShortName>Terra_SHOULD_PRESERVE</ShortName>'
                )
              }))
            })
          })
        })

        describe('when the metadata-correction service processes the ISO19115 collection', () => {
          beforeAll(async () => {
            vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
              collectionConceptId: iso19115CollectionConceptId,
              providerId,
              nativeId: iso19115NativeId,
              revisionId: 1,
              format: 'application/iso19115+xml',
              umm: readJsonFixture('iso19115.validation.umm.json')
            })

            vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue(
              readFixture('iso19115.before.xml')
            )

            vi.mocked(writeCorrectedMetadataToCmr).mockClear()

            const metadataCorrectionRequest = metadataCorrectionRequests.find((request) => (
              request.collectionConceptId === iso19115CollectionConceptId
              && request.keywordEvent.eventType === 'UPDATED'
            ))

            await metadataCorrectionService({
              Records: [{
                messageId: 'end-to-end-iso19115-run',
                body: JSON.stringify(metadataCorrectionRequest)
              }]
            })
          })

          test('should send the expected corrected metadata to CMR', () => {
            expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith(expect.objectContaining({
              collectionConceptId: iso19115CollectionConceptId,
              providerId,
              nativeId: iso19115NativeId,
              nativeFormat: 'ISO19115',
              correctedMetadata: readFixture('updates/iso19115.after.xml').trimEnd()
            }))
          })
        })

        describe('when the metadata-correction service processes the ISO-SMAP collection', () => {
          beforeAll(async () => {
            vi.mocked(getCmrCollectionUmmDetails).mockResolvedValue({
              collectionConceptId: isoSmapCollectionConceptId,
              providerId,
              nativeId: isoSmapNativeId,
              revisionId: 1,
              format: 'application/iso:smap+xml',
              umm: readJsonFixture('isosmap.validation.umm.json')
            })

            vi.mocked(getCmrCollectionNativeMetadata).mockResolvedValue(
              readFixture('isosmap.before.xml')
            )

            vi.mocked(writeCorrectedMetadataToCmr).mockClear()

            const metadataCorrectionRequest = metadataCorrectionRequests.find((request) => (
              request.collectionConceptId === isoSmapCollectionConceptId
              && request.keywordEvent.eventType === 'UPDATED'
            ))

            await metadataCorrectionService({
              Records: [{
                messageId: 'end-to-end-isosmap-run',
                body: JSON.stringify(metadataCorrectionRequest)
              }]
            })
          })

          test('should send the expected corrected metadata to CMR', () => {
            expect(writeCorrectedMetadataToCmr).toHaveBeenCalledWith(expect.objectContaining({
              collectionConceptId: isoSmapCollectionConceptId,
              providerId,
              nativeId: isoSmapNativeId,
              nativeFormat: 'ISO_SMAP',
              correctedMetadata: readFixture('updates/isosmap.after.xml').trimEnd()
            }))
          })
        })
      })
    })
  })

  describe('when applying complete correction fixtures to native metadata', () => {
    describe('when correcting UMM-C metadata for C1234567855-LOCAL', () => {
      describe('when applying updates', () => {
        test('should apply the complete update fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('updates/ummc.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'UMM',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readJsonFixture('ummc.before.json')
          })

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(result.correctedMetadata).toBe(
            JSON.stringify(readJsonFixture('updates/ummc.after.json'), null, 2)
          )
        })
      })

      describe('when applying deletions', () => {
        test('should apply the complete deletion fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('deletions/ummc.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'UMM',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readJsonFixture('deletions/ummc.before.json')
          })

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(result.correctedMetadata).toBe(
            JSON.stringify(readJsonFixture('deletions/ummc.after.json'), null, 2)
          )
        })
      })
    })

    describe('when correcting DIF10 metadata for C1234567890-LOCAL', () => {
      describe('when applying updates', () => {
        test('should apply the complete update fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('updates/dif10.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'DIF10',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readFixture('dif10.before.xml')
          })
          const correctedMetadata = result.correctedMetadata
            .trimEnd()
          const expectedMetadata = readFixture('updates/dif10.after.xml')
            .trimEnd()

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(correctedMetadata).toBe(expectedMetadata)
        })
      })

      describe('when applying deletions', () => {
        test('should apply the complete deletion fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('deletions/dif10.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'DIF10',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readFixture('dif10.before.xml')
          })
          const correctedMetadata = result.correctedMetadata
            .trimEnd()
          const expectedMetadata = readFixture('deletions/dif10.after.xml')
            .trimEnd()

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(correctedMetadata).toBe(expectedMetadata)
        })
      })
    })

    describe('when correcting ECHO10 metadata for C1234567890-LOCAL', () => {
      describe('when applying updates', () => {
        test('should apply the complete update fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('updates/echo10.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'ECHO10',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readFixture('echo10.before.xml')
          })
          const correctedMetadata = result.correctedMetadata
            .trimEnd()
          const expectedMetadata = readFixture('updates/echo10.after.xml')
            .trimEnd()

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(correctedMetadata).toBe(expectedMetadata)
        })
      })

      describe('when applying deletions', () => {
        test('should apply the complete deletion fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('deletions/echo10.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'ECHO10',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readFixture('echo10.before.xml')
          })
          // Deleting XML nodes can leave indentation-only lines behind.
          const correctedMetadata = result.correctedMetadata
            .trimEnd()
            .replace(/^[\t ]*$(?:\r?\n)?/gm, '')
          const expectedMetadata = readFixture('deletions/echo10.after.xml')
            .trimEnd()
            .replace(/^[\t ]*$(?:\r?\n)?/gm, '')

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(correctedMetadata).toBe(expectedMetadata)
        })
      })
    })

    describe('when correcting ISO19115 metadata for C1234567222-LOCAL', () => {
      describe('when applying updates', () => {
        test('should apply the complete update fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('updates/iso19115.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'ISO19115',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readFixture('iso19115.before.xml')
          })
          const correctedMetadata = result.correctedMetadata
            .trimEnd()
          const expectedMetadata = readFixture('updates/iso19115.after.xml')
            .trimEnd()

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(correctedMetadata).toBe(expectedMetadata)
        })
      })

      describe('when applying deletions', () => {
        test('should apply the complete deletion fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('deletions/iso19115.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'ISO19115',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readFixture('iso19115.before.xml')
          })
          const correctedMetadata = result.correctedMetadata
            .trimEnd()
            .replace(/^[\t ]*$(?:\r?\n)?/gm, '')
          const expectedMetadata = readFixture('deletions/iso19115.after.xml')
            .trimEnd()
            .replace(/^[\t ]*$(?:\r?\n)?/gm, '')

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(correctedMetadata).toBe(expectedMetadata)
        })
      })
    })

    describe('when correcting ISO-SMAP metadata for C1234567223-LOCAL', () => {
      describe('when applying updates', () => {
        test('should apply the complete update fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('updates/isosmap.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'ISO_SMAP',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readFixture('isosmap.before.xml')
          })
          const correctedMetadata = result.correctedMetadata
            .trimEnd()
          const expectedMetadata = readFixture('updates/isosmap.after.xml')
            .trimEnd()

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(correctedMetadata).toBe(expectedMetadata)
        })
      })

      describe('when applying deletions', () => {
        test('should apply the complete deletion fixture and generate the expected metadata', async () => {
          const correctionRequest = readJsonFixture('deletions/isosmap.corrections.json')

          const result = await invokeMetadataCorrectionDelegate({
            collectionConceptId: correctionRequest.collectionConceptId,
            nativeFormat: 'ISO_SMAP',
            source: correctionRequest.source,
            corrections: correctionRequest.corrections,
            metadataPayload: readFixture('isosmap.before.xml')
          })
          const correctedMetadata = result.correctedMetadata
            .trimEnd()
            .replace(/^[\t ]*$(?:\r?\n)?/gm, '')
          const expectedMetadata = readFixture('deletions/isosmap.after.xml')
            .trimEnd()
            .replace(/^[\t ]*$(?:\r?\n)?/gm, '')

          expect(result.correctionCount).toBe(correctionRequest.corrections.length)
          expect(correctedMetadata).toBe(expectedMetadata)
        })
      })
    })
  })
})
