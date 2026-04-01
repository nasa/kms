import { EventBridgeClient, PutEventsCommand } from '@aws-sdk/client-eventbridge'

import { CsvComparator } from '@/shared/csvComparator'
import { downloadConcepts } from '@/shared/downloadConcepts'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { logger } from '@/shared/logger'
import { getPublishUpdateQuery } from '@/shared/operations/updates/getPublishUpdateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

const PUBLISHER_EVENT_SOURCE = 'kms.publisher'
const PUBLISHER_EVENT_DETAIL_TYPE = 'kms.publisher.analysis.completed'

const publisherEventClient = new EventBridgeClient({})

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

  logger.info(`Created ${keywordEvents.length} keyword events from ${keywordChangesMap.size} schemes`)

  return keywordEvents
}

/**
 * Get keyword changes for all concept schemes by comparing draft and published versions.
 *
 * This function:
 * 1. Fetches all published concept schemes
 * 2. For each scheme, downloads CSV data for both 'draft' and 'published' versions
 * 3. Compares the two versions and identifies added, removed, and changed keywords
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

  // Get all published concept schemes
  const conceptSchemes = await getConceptSchemeDetails({ version: 'published' })

  if (!conceptSchemes || conceptSchemes.length === 0) {
    logger.warn('No concept schemes found')

    return new Map()
  }

  logger.info(`Found ${conceptSchemes.length} concept schemes to process`)

  // Initialize CSV comparator
  const csvComparator = new CsvComparator()

  // Process each scheme and collect keyword changes
  const results = await Promise.allSettled(
    conceptSchemes.map(async (scheme) => {
      const { notation } = scheme

      logger.info(`Processing concept scheme: ${notation}`)

      // Download published version (old)
      logger.debug(`Downloading published version for ${notation}`)
      const publishedCsv = await downloadConcepts({
        conceptScheme: notation,
        format: 'csv',
        version: 'published'
      })

      // Download draft version (new)
      logger.debug(`Downloading draft version for ${notation}`)
      let draftCsv
      try {
        draftCsv = await downloadConcepts({
          conceptScheme: notation,
          format: 'csv',
          version: 'draft'
        })
      } catch (error) {
        // If draft version doesn't exist (scheme renamed or deleted), skip comparison
        if (error.isSchemeNotFound) {
          logger.info(`Skipping ${notation}: scheme does not exist in draft version (may have been renamed or deleted)`)
        } else {
          logger.warn(`Skipping ${notation}: error downloading draft version - ${error.message}`)
        }

        return null
      }

      // Compare the two CSV contents
      const comparison = csvComparator.compare(publishedCsv, draftCsv)
      const summary = csvComparator.getSummary(comparison)

      logger.info(
        `Successfully processed ${notation}: `
        + `${summary.addedCount} added, `
        + `${summary.removedCount} removed, `
        + `${summary.changedCount} changed`
      )

      return {
        notation,
        comparison
      }
    })
  )

  // Collect all successful comparisons into a Map
  const keywordChangesMap = new Map(
    results
      .filter((result) => result.status === 'fulfilled' && result.value)
      .map((result) => [result.value.notation, result.value.comparison])
  )

  logger.info(`Keyword changes detection completed. Processed ${keywordChangesMap.size} concept schemes.`)

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
const emitPublisherEvent = async ({ versionName, publishDate, keywordEvents }) => {
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
 * Publisher event handler that consumes publish events from EventBridge.
 *
 * This function:
 * 1. Receives a publish event with versionName and publishDate
 * 2. Analyzes keyword changes between draft and published versions
 * 3. Creates keyword change events
 * 4. Emits a publisher-analysis-completed event for downstream consumers (cache-prime)
 *
 * @async
 * @function publisher
 * @param {Object} event - EventBridge event object.
 * @param {Object} event.detail - Event detail containing versionName and publishDate.
 * @param {string} event.detail.versionName - The name of the published version.
 * @param {string} event.detail.publishDate - ISO timestamp of the publish operation.
 * @returns {Promise<void>}
 * @throws {Error} If there's an error analyzing keyword changes or emitting events.
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
  console.log('@@@@@@@@@@@ publisher invoked')
  try {
    const { versionName, publishDate } = event.detail || {}

    if (!versionName) {
      throw new Error('versionName is required in event.detail')
    }

    if (!publishDate) {
      throw new Error('publishDate is required in event.detail')
    }

    logger.info(`[publisher] Starting analysis for version=${versionName}`)

    const keywordChanges = await getKeywordChanges()

    // Log summary of all changes
    const totalSchemes = keywordChanges.size
    logger.info(`[publisher] Analysis completed. Processed ${totalSchemes} concept schemes.`)

    // Create keyword events from the changes
    const keywordEvents = createKeywordEvents(keywordChanges)

    logger.info(`[publisher] Created ${keywordEvents.length} keyword events`)
    logger.debug('[publisher] Keyword Events:', keywordEvents)

    // Execute the publish operation
    logger.info(`[publisher] Executing publish update for version=${versionName}`)
    const updateDate = new Date().toISOString()
    const publishQuery = getPublishUpdateQuery(versionName, updateDate)

    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      body: publishQuery
    })

    if (!response.ok) {
      throw new Error(`Failed to execute publish update: ${response.status} ${response.statusText}`)
    }

    logger.info(`[publisher] Publish update completed for version=${versionName}`)

    // Emit event for cache-prime to consume
    try {
      await emitPublisherEvent({
        versionName,
        publishDate,
        keywordEvents
      })

      logger.info(`[publisher] Emitted cache-prime event for version=${versionName}`)
    } catch (eventError) {
      // Analysis succeeded; log error but don't fail the function
      logger.error(`[publisher] Failed to emit cache-prime event error=${eventError}`)
      throw eventError
    }
  } catch (error) {
    logger.error('[publisher] Error in publisher handler:', error.message)
    throw error
  }
}

export default publisher
