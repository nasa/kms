import { parse } from 'csv/sync'

import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { logger } from '@/shared/logger'

import { buildKeywordObjectFromPath } from './helpers/buildKeywordObjectFromPath'
import { KEYWORD_DIFF_SKIP_HEADER_ROWS, KEYWORD_PATH_SEPARATOR } from './helpers/constants'
import { delay } from './helpers/delay'
import { hasKeywordObjectValue } from './helpers/hasKeywordObjectValue'

/**
 * Parses a keyword CSV payload into a uuid-to-path map using the canonical path separator.
 *
 * @param {string} csvContent - Raw CSV content to parse.
 * @param {object} [options={}] - Parse options.
 * @param {number} [options.skipHeaderRows=KEYWORD_DIFF_SKIP_HEADER_ROWS] - Number of leading rows to ignore.
 * @param {string} [options.pathSeparator=KEYWORD_PATH_SEPARATOR] - Separator used to flatten path columns.
 * @returns {Map<string, string>} Map of keyword uuid to flattened path string.
 *
 * @example
 * // Request
 * const records = parseCsvContent(
 *   '"Version"\n"Category","Topic","Term","UUID"\n"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"'
 * )
 *
 * // Response
 * // Map([['uuid-1', 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS']])
 */
export const parseCsvContent = (
  csvContent,
  {
    skipHeaderRows = KEYWORD_DIFF_SKIP_HEADER_ROWS,
    pathSeparator = KEYWORD_PATH_SEPARATOR
  } = {}
) => {
  const rows = parse(csvContent || '', {
    skip_empty_lines: true,
    relax_quotes: true,
    relax_column_count: true
  })

  const dataRows = rows.slice(skipHeaderRows).filter((row) => row && row.length >= 2)

  return new Map(
    dataRows
      .map((row) => {
        const uuid = String(row[row.length - 1] || '').trim()
        const path = row
          .slice(0, -1)
          .map((column) => String(column || '').trim())
          .join(pathSeparator)

        return [uuid, path]
      })
      .filter(([uuid]) => uuid.length > 0)
  )
}

/**
 * Compares two keyword CSV payloads and groups differences into added, removed, and changed maps.
 *
 * @param {object} params - Keyword CSV comparison inputs.
 * @param {string} params.oldCsvContent - Baseline CSV content, typically `published`.
 * @param {string} params.newCsvContent - Candidate CSV content, typically `draft`.
 * @param {number} [params.skipHeaderRows=KEYWORD_DIFF_SKIP_HEADER_ROWS] - Number of leading rows to ignore.
 * @param {string} [params.pathSeparator=KEYWORD_PATH_SEPARATOR] - Separator used to flatten path columns.
 * @returns {{
 *   addedKeywords: Map<string, { oldPath: undefined, newPath: string }>,
 *   removedKeywords: Map<string, { oldPath: string, newPath: undefined }>,
 *   changedKeywords: Map<string, { oldPath: string, newPath: string }>
 * }} Keyword path comparison result.
 *
 * @example
 * // Request
 * const comparison = compareKeywordCsvContent({
 *   oldCsvContent: '"Version"\n"Category","Topic","Term","UUID"\n"EARTH SCIENCE","ATMOSPHERE","LEGACY AEROSOLS","uuid-1"',
 *   newCsvContent: '"Version"\n"Category","Topic","Term","UUID"\n"EARTH SCIENCE","ATMOSPHERE","AEROSOLS","uuid-1"'
 * })
 *
 * // Response
 * // {
 * //   addedKeywords: Map(0) {},
 * //   removedKeywords: Map(0) {},
 * //   changedKeywords: Map([
 * //     ['uuid-1', {
 * //       oldPath: 'EARTH SCIENCE > ATMOSPHERE > LEGACY AEROSOLS',
 * //       newPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
 * //     }]
 * //   ])
 * // }
 */
export const compareKeywordCsvContent = ({
  oldCsvContent,
  newCsvContent,
  skipHeaderRows = KEYWORD_DIFF_SKIP_HEADER_ROWS,
  pathSeparator = KEYWORD_PATH_SEPARATOR
}) => {
  const oldRecords = parseCsvContent(oldCsvContent, {
    skipHeaderRows,
    pathSeparator
  })
  const newRecords = parseCsvContent(newCsvContent, {
    skipHeaderRows,
    pathSeparator
  })
  const addedKeywords = new Map()
  const removedKeywords = new Map()
  const changedKeywords = new Map()

  Array.from(newRecords.entries()).forEach(([uuid, newPath]) => {
    const oldPath = oldRecords.get(uuid)

    if (oldPath === undefined) {
      addedKeywords.set(uuid, {
        oldPath: undefined,
        newPath
      })

      return
    }

    if (oldPath !== newPath) {
      changedKeywords.set(uuid, {
        oldPath,
        newPath
      })
    }
  })

  Array.from(oldRecords.entries()).forEach(([uuid, oldPath]) => {
    if (!newRecords.has(uuid)) {
      removedKeywords.set(uuid, {
        oldPath,
        newPath: undefined
      })
    }
  })

  return {
    addedKeywords,
    removedKeywords,
    changedKeywords
  }
}

/**
 * Summarizes the size of each keyword-diff bucket.
 *
 * @param {{
 *   addedKeywords: Map<string, unknown>,
 *   removedKeywords: Map<string, unknown>,
 *   changedKeywords: Map<string, unknown>
 * }} comparison - Comparison result returned by `compareKeywordCsvContent`.
 * @returns {{ addedCount: number, removedCount: number, changedCount: number }} Count summary.
 *
 * @example
 * // Request
 * const summary = getKeywordChangeSummary(comparison)
 *
 * // Response
 * // { addedCount: 1, removedCount: 0, changedCount: 2 }
 */
export const getKeywordChangeSummary = (comparison) => ({
  addedCount: comparison.addedKeywords.size,
  removedCount: comparison.removedKeywords.size,
  changedCount: comparison.changedKeywords.size
})

/**
 * Converts a keyword comparison result into plain JSON-serializable objects.
 *
 * @param {{
 *   addedKeywords: Map<string, unknown>,
 *   removedKeywords: Map<string, unknown>,
 *   changedKeywords: Map<string, unknown>
 * }} comparison - Comparison result returned by `compareKeywordCsvContent`.
 * @returns {{
 *   addedKeywords: Record<string, unknown>,
 *   removedKeywords: Record<string, unknown>,
 *   changedKeywords: Record<string, unknown>
 * }} Plain-object form of the comparison.
 *
 * @example
 * // Request
 * const json = toJSON(comparison)
 *
 * // Response
 * // {
 * //   addedKeywords: {},
 * //   removedKeywords: {},
 * //   changedKeywords: {
 * //     'uuid-1': {
 * //       oldPath: 'EARTH SCIENCE > ATMOSPHERE > LEGACY AEROSOLS',
 * //       newPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
 * //     }
 * //   }
 * // }
 */
export const toJSON = (comparison) => ({
  addedKeywords: Object.fromEntries(comparison.addedKeywords),
  removedKeywords: Object.fromEntries(comparison.removedKeywords),
  changedKeywords: Object.fromEntries(comparison.changedKeywords)
})

const buildKeywordEventObject = ({
  scheme,
  keywordPath
}) => {
  const keywordObject = buildKeywordObjectFromPath({
    scheme,
    keywordPath
  })

  return hasKeywordObjectValue(keywordObject)
    ? keywordObject
    : undefined
}

const createKeywordEvents = (keywordChangesMap) => {
  const timestamp = new Date().toISOString()
  const metadataSpecification = {
    URL: 'https://cdn.earthdata.nasa.gov/kms-keyword-event/v1.0',
    Name: 'Kms-Keyword-Event',
    Version: '1.0'
  }

  const keywordEvents = []

  keywordChangesMap.forEach((changes, scheme) => {
    const { addedKeywords, removedKeywords, changedKeywords } = changes

    addedKeywords.forEach((pathInfo, uuid) => {
      keywordEvents.push({
        EventType: 'INSERTED',
        Scheme: scheme,
        UUID: uuid,
        NewKeywordObject: buildKeywordEventObject({
          scheme,
          keywordPath: pathInfo.newPath
        }),
        Timestamp: timestamp,
        MetadataSpecification: metadataSpecification
      })
    })

    removedKeywords.forEach((pathInfo, uuid) => {
      keywordEvents.push({
        EventType: 'DELETED',
        Scheme: scheme,
        UUID: uuid,
        OldKeywordObject: buildKeywordEventObject({
          scheme,
          keywordPath: pathInfo.oldPath
        }),
        Timestamp: timestamp,
        MetadataSpecification: metadataSpecification
      })
    })

    changedKeywords.forEach((pathInfo, uuid) => {
      keywordEvents.push({
        EventType: 'UPDATED',
        Scheme: scheme,
        UUID: uuid,
        OldKeywordObject: buildKeywordEventObject({
          scheme,
          keywordPath: pathInfo.oldPath
        }),
        NewKeywordObject: buildKeywordEventObject({
          scheme,
          keywordPath: pathInfo.newPath
        }),
        Timestamp: timestamp,
        MetadataSpecification: metadataSpecification
      })
    })
  })

  return keywordEvents
}

const getKeywordChangesForScheme = async ({
  notation,
  inPublished,
  inDraft
}) => {
  // The downloader stays lazy here to avoid pulling the concept export handler into the module
  // graph until the publish flow actually needs it.
  // eslint-disable-next-line import/no-cycle
  const { downloadConcepts } = await import('@/shared/downloadConcepts')

  if (inPublished && inDraft) {
    const [publishedCsv, draftCsv] = await Promise.all([
      downloadConcepts({
        conceptScheme: notation,
        format: 'csv',
        bypassCache: true,
        version: 'published'
      }),
      downloadConcepts({
        conceptScheme: notation,
        format: 'csv',
        bypassCache: true,
        version: 'draft'
      })
    ])

    return compareKeywordCsvContent({
      oldCsvContent: publishedCsv,
      newCsvContent: draftCsv
    })
  }

  if (inPublished && !inDraft) {
    const publishedCsv = await downloadConcepts({
      conceptScheme: notation,
      format: 'csv',
      bypassCache: true,
      version: 'published'
    })

    return compareKeywordCsvContent({
      oldCsvContent: publishedCsv,
      newCsvContent: ''
    })
  }

  const draftCsv = await downloadConcepts({
    conceptScheme: notation,
    format: 'csv',
    bypassCache: true,
    version: 'draft'
  })

  return compareKeywordCsvContent({
    oldCsvContent: '',
    newCsvContent: draftCsv
  })
}

const getKeywordChangesForSchemeWithRetry = async ({
  notation,
  inPublished,
  inDraft,
  attempt = 0,
  maxRetries = 3
}) => {
  try {
    const comparison = await getKeywordChangesForScheme({
      notation,
      inPublished,
      inDraft
    })

    return {
      comparison,
      attempts: attempt + 1
    }
  } catch (error) {
    logger.warn(`Error processing ${notation} on attempt ${attempt + 1}: ${error.message}`)

    if (attempt >= maxRetries) {
      throw error
    }

    const delayMs = 2 ** attempt * 1000
    await delay(delayMs)

    return getKeywordChangesForSchemeWithRetry({
      notation,
      inPublished,
      inDraft,
      attempt: attempt + 1,
      maxRetries
    })
  }
}

/**
 * Detects keyword changes between the published and draft scheme exports and builds event payloads
 * for downstream publish-time processing.
 *
 * @param {object} [params={}] - Publish diff options.
 * @param {boolean} [params.blockOnFailure=false] - Whether a single scheme failure should abort the whole workflow.
 * @returns {Promise<{
 *   keywordChangesMap: Map<string, {
 *     addedKeywords: Map<string, { oldPath: undefined, newPath: string }>,
 *     removedKeywords: Map<string, { oldPath: string, newPath: undefined }>,
 *     changedKeywords: Map<string, { oldPath: string, newPath: string }>
 *   }>,
 *   keywordEvents: Array<object>,
 *   keywordChangeSummary: { addedCount: number, removedCount: number, changedCount: number },
 *   failedSchemes: Array<{ notation: string, error: string }>,
 *   totalSchemeCount: number,
 *   keywordChangeCount: number
 * }>} Publish keyword diff result and synthesized events.
 * @throws {Error} When `blockOnFailure` is enabled and one or more scheme comparisons fail.
 *
 * @example
 * // Request
 * const result = await getPublishKeywordEvents({
 *   blockOnFailure: false
 * })
 *
 * // Response
 * // {
 * //   keywordChangesMap: Map([['sciencekeywords', comparison]]),
 * //   keywordEvents: [
 * //     {
 * //       EventType: 'UPDATED',
 * //       Scheme: 'sciencekeywords',
 * //       UUID: '2e5a401b-1507-4f57-82b8-36557c13b154',
 * //       OldKeywordObject: { Category: 'EARTH SCIENCE', Topic: 'ATMOSPHERE', Term: 'LEGACY AEROSOLS' },
 * //       NewKeywordObject: { Category: 'EARTH SCIENCE', Topic: 'ATMOSPHERE', Term: 'AEROSOLS' },
 * //       Timestamp: '2026-06-04T15:20:00.000Z',
 * //       MetadataSpecification: {
 * //         URL: 'https://cdn.earthdata.nasa.gov/kms-keyword-event/v1.0',
 * //         Name: 'Kms-Keyword-Event',
 * //         Version: '1.0'
 * //       }
 * //     }
 * //   ],
 * //   keywordChangeSummary: { addedCount: 0, removedCount: 0, changedCount: 1 },
 * //   failedSchemes: [],
 * //   totalSchemeCount: 43,
 * //   keywordChangeCount: 1
 * // }
 */
export const getPublishKeywordEvents = async ({
  blockOnFailure = false
} = {}) => {
  const normalizedPublishedSchemes = await getConceptSchemeDetails({
    version: 'published'
  })
  const normalizedDraftSchemes = await getConceptSchemeDetails({
    version: 'draft'
  })
  const publishedSchemes = Array.isArray(normalizedPublishedSchemes)
    ? normalizedPublishedSchemes
    : []
  const draftSchemes = Array.isArray(normalizedDraftSchemes)
    ? normalizedDraftSchemes
    : []
  const publishedNotations = new Set(publishedSchemes.map((scheme) => scheme.notation))
  const draftNotations = new Set(draftSchemes.map((scheme) => scheme.notation))
  const allNotations = new Set([...publishedNotations, ...draftNotations])
  const failedSchemes = []

  if (allNotations.size === 0) {
    logger.warn('No concept schemes found in either version')

    return {
      keywordChangesMap: new Map(),
      keywordEvents: [],
      keywordChangeSummary: {
        addedCount: 0,
        removedCount: 0,
        changedCount: 0
      },
      failedSchemes: [],
      totalSchemeCount: 0,
      keywordChangeCount: 0
    }
  }

  const results = await Array.from(allNotations).reduce(async (resultsPromise, notation) => {
    const sequentialResults = await resultsPromise
    const result = await (async () => {
      const inPublished = publishedNotations.has(notation)
      const inDraft = draftNotations.has(notation)
      let lastError

      try {
        const { comparison } = await getKeywordChangesForSchemeWithRetry({
          notation,
          inPublished,
          inDraft
        })

        return {
          notation,
          summary: {
            addedCount: comparison.addedKeywords.size,
            removedCount: comparison.removedKeywords.size,
            changedCount: comparison.changedKeywords.size
          },
          comparison
        }
      } catch (error) {
        lastError = error
      }

      logger.error(`Failed ${notation}: exhausted all 4 attempts - ${lastError?.message}`)

      failedSchemes.push({
        notation,
        error: lastError?.message || 'Unknown error'
      })

      return null
    })()

    sequentialResults.push(result)

    return sequentialResults
  }, Promise.resolve([]))

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

  if (failedSchemes.length > 0) {
    const failedSchemeSummary = failedSchemes
      .map(({ notation, error }) => `${notation}: ${error}`)
      .join('; ')

    const failureMessage = (
      `Keyword changes detection failed for ${failedSchemes.length} `
      + `scheme(s): ${failedSchemeSummary}`
    )

    if (blockOnFailure) {
      throw new Error(failureMessage)
    }

    logger.warn(
      `[publisher] ${failureMessage}. `
      + 'Continuing with publish because BLOCK_PUBLISH_ON_KEYWORD_DIFF_FAILURE is disabled.'
    )
  }

  logger.info(
    '[publisher] Keyword changes summary '
    + `schemes=${allNotations.size} `
    + `processed=${keywordChangesMap.size} `
    + `failed=${failedSchemes.length} `
    + `added=${keywordChangeSummary.addedCount} `
    + `removed=${keywordChangeSummary.removedCount} `
    + `changed=${keywordChangeSummary.changedCount}`
  )

  const keywordEvents = createKeywordEvents(keywordChangesMap)
  const keywordChangeCount = (
    keywordChangeSummary.addedCount
    + keywordChangeSummary.removedCount
    + keywordChangeSummary.changedCount
  )

  return {
    keywordChangesMap,
    keywordEvents,
    keywordChangeSummary,
    failedSchemes,
    totalSchemeCount: allNotations.size,
    keywordChangeCount
  }
}
