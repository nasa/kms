import { PutEventsCommand } from '@aws-sdk/client-eventbridge'

import { getEventBridgeClient } from '@/shared/awsClients'
import { buildHistoricalConceptCache } from '@/shared/buildHistoricalConceptCache'
import { CsvComparator } from '@/shared/csvComparator'
import { downloadConcepts } from '@/shared/downloadConcepts'
import { emitPublisherMetrics, PUBLISHER_METRIC_NAMES } from '@/shared/emitPublisherMetrics'
import { exportPublishSchemeCsvToS3 } from '@/shared/exportPublishSchemeCsvToS3'
import { exportRdfToS3 } from '@/shared/exportRdfToS3'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { getApplicationConfig } from '@/shared/getConfig'
import { logger } from '@/shared/logger'
import { getPublishUpdateQuery } from '@/shared/operations/updates/getPublishUpdateQuery'
import { publishKeywordEvent } from '@/shared/publishKeywordEvent'
import { sparqlRequest } from '@/shared/sparqlRequest'

const PUBLISHER_EVENT_SOURCE = 'kms.publisher'
const PUBLISHER_EVENT_DETAIL_TYPE = 'kms.publisher.analysis.completed'
const KEYWORD_EVENT_PUBLISH_RETRIES = 3

const publisherEventClient = getEventBridgeClient()

/**
 * Indicates whether keyword diff failures should block publish completion.
 *
 * This toggle lets us roll out the metrics/eventing path without making
 * keyword comparison failures fatal in environments where the downstream flow
 * is still being validated.
 *
 * @returns {boolean} True when publish should fail on keyword diff errors.
 */
const shouldBlockPublishOnKeywordDiffFailure = () => (
  process.env.BLOCK_PUBLISH_ON_KEYWORD_DIFF_FAILURE === 'true'
)

/**
 * Counts the total number of added, removed, and changed keywords across all schemes.
 *
 * @param {Map<string, Object>} keywordChangesMap - Per-scheme comparison results.
 * @returns {number} Total keyword changes detected for the publish run.
 */
const countKeywordChanges = (keywordChangesMap) => Array.from(keywordChangesMap.values()).reduce(
  (total, { addedKeywords, removedKeywords, changedKeywords }) => total
    + addedKeywords.size
    + removedKeywords.size
    + changedKeywords.size,
  0
)

/**
 * Emits publisher metrics without failing the overall publish flow on metric errors.
 *
 * Metrics are observability-only for this path, so failed emission is logged for
 * debugging but does not block publish completion.
 *
 * @param {Array<{metricName: string, value: number}>} metrics - Metrics to emit.
 * @param {string} context - Human-readable context used in failure logs.
 * @returns {Promise<void>}
 */
const emitPublisherMetricsSafely = async (metrics, context) => {
  try {
    await emitPublisherMetrics({ metrics })
  } catch (metricError) {
    logger.error(
      `[publisher] Failed to emit keyword sync metrics for ${context}. `
      + `Error: ${metricError.message}`
    )
  }
}

/**
 * Transform keyword changes map into a list of keyword events conforming to the schema.
 *
 * @async
 * @function createKeywordEvents
 * @param {Map<string, Object>} keywordChangesMap - Map where key is scheme notation and value contains addedKeywords, removedKeywords, and changedKeywords Maps
 * @returns {Array<Object>} Array of keyword event objects conforming to the keyword-event-json-schema
 *
 * @example
 * const keywordChangesMap = new Map([
 *   ['sciencekeywords', {
 *     addedKeywords: Map([['uuid1', { oldPath: undefined, newPath: 'EARTH SCIENCE > ATMOSPHERE' }]]),
 *     removedKeywords: Map([['uuid2', { oldPath: 'OLD PATH', newPath: undefined }]]),
 *     changedKeywords: Map([['uuid3', { oldPath: 'OLD PATH', newPath: 'NEW PATH' }]])
 *   }]
 * ]);
 * const events = createKeywordEvents(keywordChangesMap);
 * // [
 * //   { EventType: 'INSERTED', Scheme: 'sciencekeywords', UUID: 'uuid1', NewKeywordPath: 'EARTH SCIENCE > ATMOSPHERE', ... },
 * //   { EventType: 'DELETED', Scheme: 'sciencekeywords', UUID: 'uuid2', OldKeywordPath: 'OLD PATH', ... },
 * //   { EventType: 'UPDATED', Scheme: 'sciencekeywords', UUID: 'uuid3', OldKeywordPath: 'OLD PATH', NewKeywordPath: 'NEW PATH', ... }
 * // ]
 */
export const createKeywordEvents = (keywordChangesMap) => {
  const timestamp = new Date().toISOString()
  const metadataSpecification = {
    URL: 'https://cdn.earthdata.nasa.gov/kms-keyword-event/v1.0',
    Name: 'Kms-Keyword-Event',
    Version: '1.0'
  }

  const keywordEvents = []

  // Process each scheme in the map
  keywordChangesMap.forEach((changes, scheme) => {
    const { addedKeywords, removedKeywords, changedKeywords } = changes

    // Process added keywords (INSERTED events)
    addedKeywords.forEach((pathInfo, uuid) => {
      keywordEvents.push({
        EventType: 'INSERTED',
        Scheme: scheme,
        UUID: uuid,
        NewKeywordPath: pathInfo.newPath,
        Timestamp: timestamp,
        MetadataSpecification: metadataSpecification
      })
    })

    // Process removed keywords (DELETED events)
    removedKeywords.forEach((pathInfo, uuid) => {
      keywordEvents.push({
        EventType: 'DELETED',
        Scheme: scheme,
        UUID: uuid,
        OldKeywordPath: pathInfo.oldPath,
        Timestamp: timestamp,
        MetadataSpecification: metadataSpecification
      })
    })

    // Process changed keywords (UPDATED events)
    changedKeywords.forEach((pathInfo, uuid) => {
      keywordEvents.push({
        EventType: 'UPDATED',
        Scheme: scheme,
        UUID: uuid,
        OldKeywordPath: pathInfo.oldPath,
        NewKeywordPath: pathInfo.newPath,
        Timestamp: timestamp,
        MetadataSpecification: metadataSpecification
      })
    })
  })

  return keywordEvents
}

/**
 * Get keyword changes for all concept schemes by comparing draft and published versions.
 *
 * This function:
 * 1. Fetches concept schemes from both 'published' and 'draft' versions
 * 2. For each scheme, downloads CSV data for both versions
 * 3. Compares the two versions and identifies added, removed, and changed keywords
 * 4. Handles three cases:
 *    - Schemes in both versions: normal comparison
 *    - Schemes only in published: all keywords marked as DELETED
 *    - Schemes only in draft: all keywords marked as INSERTED
 *
 * @async
 * @function getKeywordChanges
 * @returns {Promise<Map<string, Object>>} A Map where:
 *   - key: concept scheme notation (e.g., 'sciencekeywords', 'platforms')
 *   - value: comparison result object containing addedKeywords, removedKeywords, and changedKeywords Maps
 * @throws {Error} If there's an error fetching concept schemes or downloading concepts
 *
 * @example
 * const keywordChanges = await getKeywordChanges();
 * // Map {
 * //   'sciencekeywords' => { addedKeywords: Map, removedKeywords: Map, changedKeywords: Map },
 * //   'platforms' => { addedKeywords: Map, removedKeywords: Map, changedKeywords: Map },
 * //   ...
 * // }
 */
export const getKeywordChanges = async () => {
  logger.info('Starting keyword changes detection')

  // Get concept schemes from both versions
  const [publishedSchemes, draftSchemes] = await Promise.all([
    getConceptSchemeDetails({ version: 'published' }),
    getConceptSchemeDetails({ version: 'draft' })
  ])

  const publishedNotations = new Set((publishedSchemes || []).map((s) => s.notation))
  const draftNotations = new Set((draftSchemes || []).map((s) => s.notation))

  // Get all unique scheme notations from both versions
  const allNotations = new Set([...publishedNotations, ...draftNotations])

  if (allNotations.size === 0) {
    logger.warn('No concept schemes found in either version')

    return new Map()
  }

  // Initialize CSV comparator
  const csvComparator = new CsvComparator()
  const failedSchemes = []
  // Process each scheme sequentially to avoid overwhelming local RDF4J with many
  // concurrent CSV/SPARQL requests at once.
  const results = await Array.from(allNotations).reduce(async (resultsPromise, notation) => {
    const sequentialResults = await resultsPromise
    const result = await (async () => {
      const inPublished = publishedNotations.has(notation)
      const inDraft = draftNotations.has(notation)
      let comparison
      let lastError
      const maxRetries = 3 // 4 total attempts (initial + 3 retries)

      /* eslint-disable no-await-in-loop */
      for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
        try {
          if (inPublished && inDraft) {
          // Normal case: scheme exists in both versions
            const [publishedCsv, draftCsv] = await Promise.all([
              downloadConcepts({
                conceptScheme: notation,
                format: 'csv',
                version: 'published',
                bypassCache: true
              }),
              downloadConcepts({
                conceptScheme: notation,
                format: 'csv',
                version: 'draft',
                bypassCache: true
              })
            ])

            comparison = csvComparator.compare(publishedCsv, draftCsv)
          } else if (inPublished && !inDraft) {
          // Scheme removed: all keywords marked as DELETED
            const publishedCsv = await downloadConcepts({
              conceptScheme: notation,
              format: 'csv',
              version: 'published',
              bypassCache: true
            })

            // Compare with empty string to mark all as deleted
            comparison = csvComparator.compare(publishedCsv, '')
          } else {
          // All notations come from the union of published and draft scheme sets,
          // so reaching this branch means the scheme only exists in draft.
            const draftCsv = await downloadConcepts({
              conceptScheme: notation,
              format: 'csv',
              version: 'draft',
              bypassCache: true
            })

            // Compare empty string with draft to mark all as added
            comparison = csvComparator.compare('', draftCsv)
          }

          const summary = csvComparator.getSummary(comparison)

          return {
            notation,
            summary,
            comparison
          }
        } catch (error) {
          lastError = error
          logger.warn(`Error processing ${notation} on attempt ${attempt + 1}: ${error.message}`)

          // If this was the last retry, don't wait - exit loop and return null
          if (attempt === maxRetries) {
            break
          }

          // Wait before retrying (exponential backoff: 1s, 2s, 4s)
          const delayMs = 2 ** attempt * 1000
          await new Promise((resolve) => {
            setTimeout(resolve, delayMs)
          })
        }
      }

      // All retries exhausted
      logger.error(`Failed ${notation}: exhausted all ${maxRetries + 1} attempts - ${lastError?.message}`)
      failedSchemes.push({
        notation,
        error: lastError?.message || 'Unknown error'
      })

      return null
    })()

    sequentialResults.push(result)

    return sequentialResults
  }, Promise.resolve([]))

  if (failedSchemes.length > 0) {
    const failedSchemeSummary = failedSchemes
      .map(({ notation, error }) => `${notation}: ${error}`)
      .join('; ')

    const failureMessage = (
      `Keyword changes detection failed for ${failedSchemes.length} `
      + `scheme(s): ${failedSchemeSummary}`
    )

    if (shouldBlockPublishOnKeywordDiffFailure()) {
      throw new Error(failureMessage)
    }

    logger.warn(
      `[publisher] ${failureMessage}. `
      + 'Continuing with publish because BLOCK_PUBLISH_ON_KEYWORD_DIFF_FAILURE is disabled.'
    )
  }

  // Failed schemes return null placeholders while retries/summary are being tracked. When
  // blocking is disabled, continue with only the successful scheme comparisons.
  const keywordChangesMap = new Map(
    results
      .filter((result) => result !== null)
      .map((result) => [result.notation, result.comparison])
  )

  const keywordChangeSummary = results.reduce((summary, result) => {
    if (!result) {
      return summary
    }

    return {
      addedCount: summary.addedCount + result.summary.addedCount,
      removedCount: summary.removedCount + result.summary.removedCount,
      changedCount: summary.changedCount + result.summary.changedCount
    }
  }, {
    addedCount: 0,
    removedCount: 0,
    changedCount: 0
  })

  logger.info(
    '[publisher] Keyword changes summary '
    + `schemes=${allNotations.size} `
    + `processed=${keywordChangesMap.size} `
    + `failed=${failedSchemes.length} `
    + `added=${keywordChangeSummary.addedCount} `
    + `removed=${keywordChangeSummary.removedCount} `
    + `changed=${keywordChangeSummary.changedCount}`
  )

  return keywordChangesMap
}

/**
 * Emits a publisher-analysis-completed event to EventBridge so cache-prime can run asynchronously.
 *
 * @async
 * @param {Object} params - Event payload details.
 * @param {string} params.versionName - Published version name.
 * @param {string} params.publishDate - ISO publish timestamp.
 * @param {Array<Object>} params.keywordEvents - Array of keyword change events.
 * @returns {Promise<void>}
 * @throws {Error} When EventBridge reports failed entries.
 */
const emitCachingEvent = async ({ versionName, publishDate, keywordEvents }) => {
  const eventBusName = process.env.PRIME_CACHE_EVENT_BUS_NAME || 'default'

  const response = await publisherEventClient.send(new PutEventsCommand({
    Entries: [
      {
        EventBusName: eventBusName,
        Source: PUBLISHER_EVENT_SOURCE,
        DetailType: PUBLISHER_EVENT_DETAIL_TYPE,
        Detail: JSON.stringify({
          version: 'published',
          versionName,
          publishDate,
          keywordEvents,
          totalEvents: keywordEvents.length
        })
      }
    ]
  }))

  if (response.FailedEntryCount && response.FailedEntryCount > 0) {
    throw new Error(`Failed to emit publisher event. failedEntryCount=${response.FailedEntryCount}`)
  }
}

/**
 * Publishes keyword events to SNS with bounded per-event retries.
 *
 * @async
 * @param {Array<Object>} keywordEvents - Keyword event payloads to publish.
 * @returns {Promise<{
 *   attemptedCount: number,
 *   publishedCount: number,
 *   failedEvents: Array<{ keywordEvent: Object, error: string, attempts: number }>
 * }>} SNS publish summary for the completed batch.
 */
const publishKeywordEvents = async (keywordEvents) => keywordEvents.reduce(
  async (summaryPromise, keywordEvent) => {
    const summary = await summaryPromise
    let lastError
    let attempts = 0

    for (let retry = 0; retry <= KEYWORD_EVENT_PUBLISH_RETRIES; retry += 1) {
      attempts += 1

      try {
        if (retry > 0) {
          logger.info(
            '[publisher] Retrying keyword event publish '
              + `(attempt ${retry + 1}/${KEYWORD_EVENT_PUBLISH_RETRIES + 1}) `
              + `uuid=${keywordEvent.UUID} type=${keywordEvent.EventType}`
          )
        }

        await publishKeywordEvent(keywordEvent)
        summary.publishedCount += 1
        lastError = undefined
        break
      } catch (error) {
        lastError = error
        logger.warn(
          '[publisher] Keyword event publish failed '
            + `attempt=${retry + 1}/${KEYWORD_EVENT_PUBLISH_RETRIES + 1} `
            + `uuid=${keywordEvent.UUID} type=${keywordEvent.EventType} `
            + `scheme=${keywordEvent.Scheme} error=${error.message}`
        )
      }
    }

    if (lastError) {
      summary.failedEvents.push({
        keywordEvent,
        error: lastError.message,
        attempts
      })
    }

    return summary
  },
  Promise.resolve({
    attemptedCount: keywordEvents.length,
    publishedCount: 0,
    failedEvents: []
  })
)

/**
 * Publisher event handler that consumes publish events from EventBridge.
 *
 * This function:
 * 1. Receives a publish event with versionName and publishDate
 * 2. Analyzes keyword changes between draft and published versions
 * 3. Executes the publish update
 * 4. Prepares the published and historical keyword caches used by downstream consumers
 * 5. Creates and publishes keyword change events to SNS once caches are ready
 * 6. Emits a publisher-analysis-completed event for downstream consumers (cache-prime)
 *
 * @async
 * @function publisher
 * @param {Object} event - EventBridge event object.
 * @param {Object} event.detail - Event detail containing versionName and publishDate.
 * @param {string} event.detail.versionName - The name of the published version.
 * @param {string} event.detail.publishDate - ISO timestamp of the publish operation.
 * @returns {Promise<Object>} Publish result summary.
 * @throws {Error} If there's an error analyzing keyword changes or executing the publish update.
 *
 * @example
 * // EventBridge event format
 * const event = {
 *   detail: {
 *     versionName: 'v1.0.0',
 *     publishDate: '2023-06-01T12:00:00.000Z'
 *   }
 * };
 * await publisher(event);
 */
export const publisher = async (event) => {
  const startTime = Date.now()
  logger.info('[publisher] start')
  try {
    const { versionName, publishDate } = event.detail || {}

    if (!versionName) {
      throw new Error('versionName is required in event.detail')
    }

    if (!publishDate) {
      throw new Error('publishDate is required in event.detail')
    }

    logger.info(`[publisher] Starting analysis for version=${versionName}`)

    // Track timing for each process
    const processTimes = {}

    // 1. Detect keyword changes and create keyword change events
    let processStartTime = Date.now()
    const keywordChanges = await getKeywordChanges()
    const keywordChangesDetected = countKeywordChanges(keywordChanges)

    const keywordEvents = createKeywordEvents(keywordChanges)
    const keywordEventsGenerated = keywordEvents.length
    processTimes.keywordChangesDetection = ((Date.now() - processStartTime) / 1000).toFixed(2)

    // 2. Execute the publish operation
    processStartTime = Date.now()
    logger.info(`[publisher] Executing publish update for version=${versionName}`)
    const publishQuery = getPublishUpdateQuery(versionName, publishDate)

    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      body: publishQuery
    })

    if (!response.ok) {
      throw new Error(`Failed to execute publish update: ${response.status} ${response.statusText}`)
    }

    processTimes.publishOperation = ((Date.now() - processStartTime) / 1000).toFixed(2)
    logger.info(`[publisher] Publish update completed for version=${versionName}`)

    let keywordEventsPublished = 0
    let keywordEventPublishFailures = 0
    const postPublishFailures = []

    // 3. Prepare the published and historical keyword caches before any downstream
    // metadata-correction consumers see the keyword events.
    processStartTime = Date.now()
    logger.info('[publisher] Starting published keyword cache preparation.')

    let csvExportSucceeded = false
    let publishedCacheReady = false
    try {
      const csvExportResult = await exportPublishSchemeCsvToS3()
      processTimes.exportPublishedCsv = ((Date.now() - processStartTime) / 1000).toFixed(2)
      csvExportSucceeded = true
      publishedCacheReady = csvExportResult.cacheReady
      logger.info('[publisher] Successfully exported Published Scheme CSVs to S3.')
    } catch (exportError) {
      processTimes.exportPublishedCsv = ((Date.now() - processStartTime) / 1000).toFixed(2)
      const failureMessage = `Failed to export Published Scheme CSVs to S3: ${exportError.message}`
      postPublishFailures.push(failureMessage)
      logger.error(`[publisher] ${failureMessage}`)
    }

    // 4. Build the historical concept cache for all versions
    // Only rebuild cache if CSV export succeeded to avoid serving stale data.
    // Note: buildHistoricalConceptCache now fails fast on any listing or processing errors
    // to ensure cache completeness. We catch these errors here to allow the publish to
    // complete (since the SPARQL update has already succeeded), but report partial_success
    // so operators know the cache rebuild failed and no keyword events were emitted.
    processStartTime = Date.now()
    let historicalCacheBuildSucceeded = false
    let historicalCacheReady = false
    if (csvExportSucceeded) {
      logger.info('[publisher] Starting Historical Concept cache build from S3.')
      try {
        const { env } = getApplicationConfig()
        const bucketName = `kms-rdf-backup-${env}`
        const historicalCacheResult = await buildHistoricalConceptCache(bucketName)
        processTimes.buildHistoricalCache = ((Date.now() - processStartTime) / 1000).toFixed(2)
        historicalCacheBuildSucceeded = true
        historicalCacheReady = historicalCacheResult.cacheReady
        logger.info(`[publisher] Successfully built Historical Concept cache from S3 bucket [${bucketName}].`)
      } catch (cacheBuildError) {
        processTimes.buildHistoricalCache = ((Date.now() - processStartTime) / 1000).toFixed(2)
        const failureMessage = `Failed to build Historical Concept cache from S3: ${cacheBuildError.message}`
        postPublishFailures.push(failureMessage)
        logger.error(`[publisher] ${failureMessage}`)
      }
    } else {
      processTimes.buildHistoricalCache = '0.00'
      const skipMessage = 'Skipped Historical Concept cache build because CSV export failed'
      postPublishFailures.push(skipMessage)
      logger.warn(`[publisher] ${skipMessage}`)
    }

    const keywordCachesReady = (
      csvExportSucceeded
      && publishedCacheReady
      && historicalCacheBuildSucceeded
      && historicalCacheReady
    )

    // 5. Publish keyword events only after both cache families are ready.
    processStartTime = Date.now()
    if (keywordEvents.length > 0) {
      if (!keywordCachesReady) {
        const skipMessage = 'Skipped keyword event publish because keyword caches were not fully prepared'
        postPublishFailures.push(skipMessage)
        logger.warn(`[publisher] ${skipMessage}`)
      } else {
        const publishSummary = await publishKeywordEvents(keywordEvents)
        keywordEventsPublished = publishSummary.publishedCount
        keywordEventPublishFailures = publishSummary.failedEvents.length

        if (publishSummary.failedEvents.length > 0) {
          postPublishFailures.push(
            `Publish completed, but ${publishSummary.failedEvents.length} `
            + 'keyword event publishes failed after retries'
          )

          publishSummary.failedEvents.forEach(({ keywordEvent, error, attempts }) => {
            logger.error(
              '[publisher] Keyword event publish exhausted retries',
              {
                uuid: keywordEvent.UUID,
                scheme: keywordEvent.Scheme,
                eventType: keywordEvent.EventType,
                oldKeywordPath: keywordEvent.OldKeywordPath,
                newKeywordPath: keywordEvent.NewKeywordPath,
                attempts,
                error
              }
            )
          })
        }

        logger.info(
          '[publisher] Keyword event publish summary '
          + `attempted=${publishSummary.attemptedCount} `
          + `published=${publishSummary.publishedCount} `
          + `failed=${publishSummary.failedEvents.length}`
        )
      }
    } else {
      logger.info('[publisher] No keyword events generated, skipping SNS publish')
    }

    processTimes.keywordEventsPublish = ((Date.now() - processStartTime) / 1000).toFixed(2)

    // #########################################################################
    // ## IMPORTANT: ARCHIVAL EXPORT TIMEOUT CONSIDERATIONS
    // ##
    // ## The RDF exports below are post-publish archival work. The keyword-event
    // ## consumers now rely on the Redis cache-preparation path above, so cache
    // ## readiness stays ahead of SNS publication even if these exports slow down.
    // ##
    // ## If the archival exports start getting close to the timeout, we should:
    // ##  1. Move this work to a separate, asynchronous Lambda function.
    // ##  2. Keep cache preparation ahead of keyword event publication so
    // ##     metadata-correction consumers never observe a cold Redis state.
    // #########################################################################
    logger.info('[publisher] Starting archival RDF exports.')

    // 6. Export published RDF to S3
    processStartTime = Date.now()
    try {
      await exportRdfToS3({ version: 'published' })
      processTimes.exportPublishedRdf = ((Date.now() - processStartTime) / 1000).toFixed(2)
      logger.info('[publisher] Successfully exported Published RDF to S3.')
    } catch (exportError) {
      processTimes.exportPublishedRdf = ((Date.now() - processStartTime) / 1000).toFixed(2)
      const failureMessage = `Failed to export Published RDF to S3: ${exportError.message}`
      postPublishFailures.push(failureMessage)
      logger.error(`[publisher] ${failureMessage}`)
    }

    // 7. Export draft RDF to S3
    processStartTime = Date.now()
    try {
      await exportRdfToS3({ version: 'draft' })
      processTimes.exportDraftRdf = ((Date.now() - processStartTime) / 1000).toFixed(2)
      logger.info('[publisher] Successfully exported Draft RDF to S3.')
    } catch (exportError) {
      processTimes.exportDraftRdf = ((Date.now() - processStartTime) / 1000).toFixed(2)
      const failureMessage = `Failed to export Draft RDF to S3: ${exportError.message}`
      postPublishFailures.push(failureMessage)
      logger.error(`[publisher] ${failureMessage}`)
    }

    // 8. Emit publisher metrics
    processStartTime = Date.now()
    await emitPublisherMetricsSafely(
      [
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_CHANGES_DETECTED,
          value: keywordChangesDetected
        },
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_GENERATED,
          value: keywordEventsGenerated
        },
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENTS_PUBLISHED,
          value: keywordEventsPublished
        },
        {
          metricName: PUBLISHER_METRIC_NAMES.KEYWORD_EVENT_PUBLISH_FAILURES,
          value: keywordEventPublishFailures
        }
      ],
      'keyword sync summary'
    )

    processTimes.emitMetrics = ((Date.now() - processStartTime) / 1000).toFixed(2)

    // 9. Emit event for cache-prime to consume
    let cachePrimeEventEmitted = false
    processStartTime = Date.now()

    try {
      await emitCachingEvent({
        versionName,
        publishDate,
        keywordEvents
      })

      cachePrimeEventEmitted = true
      processTimes.emitCachePrimeEvent = ((Date.now() - processStartTime) / 1000).toFixed(2)
      logger.info(`[publisher] Emitted cache-prime event for version=${versionName}`)
    } catch (eventError) {
      // Analysis and publish succeeded; log error but don't fail the function.
      processTimes.emitCachePrimeEvent = ((Date.now() - processStartTime) / 1000).toFixed(2)
      const failureMessage = 'Publish completed, but failed to emit cache-prime event'
      postPublishFailures.push(failureMessage)
      logger.error(`[publisher] ${failureMessage}. Error: ${eventError.message}`)
    }

    const result = {
      status: postPublishFailures.length === 0 ? 'success' : 'partial_success',
      versionName,
      publishDate,
      published: true,
      keywordChangesDetected,
      keywordEventsGenerated,
      keywordEventsPublished,
      keywordEventPublishFailures,
      cachePrimeEventEmitted,
      keywordEventsCount: keywordEvents.length,
      postPublishFailures
    }

    const durationInMs = Date.now() - startTime
    const durationInSeconds = (durationInMs / 1000).toFixed(2)

    logger.info(
      `[publisher] Completed with status: ${result.status} in ${durationInSeconds} seconds. `
      + `Timing: 1.KeywordChanges=${processTimes.keywordChangesDetection}s `
      + `2.PublishOp=${processTimes.publishOperation}s `
      + `3.ExportCsv=${processTimes.exportPublishedCsv}s `
      + `4.BuildCache=${processTimes.buildHistoricalCache}s `
      + `5.PublishEvents=${processTimes.keywordEventsPublish}s `
      + `6.ExportPubRdf=${processTimes.exportPublishedRdf}s `
      + `7.ExportDraftRdf=${processTimes.exportDraftRdf}s `
      + `8.EmitMetrics=${processTimes.emitMetrics}s `
      + `9.EmitCachePrime=${processTimes.emitCachePrimeEvent}s`,
      result
    )

    return result
  } catch (error) {
    const durationInMs = Date.now() - startTime
    const durationInSeconds = (durationInMs / 1000).toFixed(2)
    logger.error(`[publisher] Error in publisher handler after ${durationInSeconds} seconds:`, error.message)
    throw error
  }
}

export default publisher
