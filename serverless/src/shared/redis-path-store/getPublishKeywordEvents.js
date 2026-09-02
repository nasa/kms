import { downloadConcepts } from '@/shared/downloadConcepts'
import { getConceptSchemeDetails } from '@/shared/getConceptSchemeDetails'
import { logger } from '@/shared/logger'

import { KEYWORD_DIFF_SKIP_HEADER_ROWS, KEYWORD_PATH_SEPARATOR } from './helpers/constants'
import { delay } from './helpers/delay'
import { parseKeywordCsvContent as parseCsvContent } from './helpers/keywordCsv'

export { parseCsvContent }

/**
 * Compares two keyword CSV payloads and groups differences into added, removed, and changed maps.
 * Keyword objects contain the scheme's named hierarchy fields. They also include `LongName` for
 * schemes that support it and `DataCenterURL` for providers when those values are present.
 *
 * @param {object} params - Keyword CSV comparison inputs.
 * @param {string} params.oldCsvContent - Baseline CSV content, typically `published`.
 * @param {string} params.newCsvContent - Candidate CSV content, typically `draft`.
 * @param {string} params.scheme - Scheme used to normalize CSV column order.
 * @param {number} [params.skipHeaderRows=KEYWORD_DIFF_SKIP_HEADER_ROWS] - Number of leading rows to ignore.
 * @param {string} [params.pathSeparator=KEYWORD_PATH_SEPARATOR] - Separator used to flatten path columns.
 * @returns {{
 *   addedKeywords: Map<string, {
 *     oldPath: undefined,
 *     newPath: string,
 *     newKeywordObject: Record<string, string>|undefined
 *   }>,
 *   removedKeywords: Map<string, {
 *     oldPath: string,
 *     newPath: undefined,
 *     oldKeywordObject: Record<string, string>|undefined
 *   }>,
 *   changedKeywords: Map<string, {
 *     oldPath: string,
 *     newPath: string,
 *     oldKeywordObject: Record<string, string>|undefined,
 *     newKeywordObject: Record<string, string>|undefined
 *   }>
 * }} Keyword path comparison result.
 *
 * @example
 * // Request
 * const comparison = compareKeywordCsvContent({
 *   oldCsvContent: '"Version"\n"Basis","Category","Sub_Category","Short_Name","Long_Name","UUID"\n'
 *     + '"Space-based Platforms","Earth Observation Satellites","","GOSAT","Greenhouse Gases Observing Satellite","uuid-1"',
 *   newCsvContent: '"Version"\n"Basis","Category","Sub_Category","Short_Name","Long_Name","UUID"\n'
 *     + '"Space-based Platforms","Earth Observation Satellites","","GOSAT - Test1","Greenhouse Gases Observing Satellite","uuid-1"',
 *   scheme: 'platforms'
 * })
 *
 * // Response
 * // {
 * //   addedKeywords: Map(0) {},
 * //   removedKeywords: Map(0) {},
 * //   changedKeywords: Map([
 * //     ['uuid-1', {
 * //       oldPath: 'Space-based Platforms > Earth Observation Satellites >  > GOSAT',
 * //       newPath: 'Space-based Platforms > Earth Observation Satellites >  > GOSAT - Test1',
 * //       oldKeywordObject: {
 * //         Basis: 'Space-based Platforms',
 * //         Category: 'Earth Observation Satellites',
 * //         SubCategory: '',
 * //         ShortName: 'GOSAT',
 * //         LongName: 'Greenhouse Gases Observing Satellite'
 * //       },
 * //       newKeywordObject: {
 * //         Basis: 'Space-based Platforms',
 * //         Category: 'Earth Observation Satellites',
 * //         SubCategory: '',
 * //         ShortName: 'GOSAT - Test1',
 * //         LongName: 'Greenhouse Gases Observing Satellite'
 * //       }
 * //     }]
 * //   ])
 * // }
 */
export const compareKeywordCsvContent = ({
  oldCsvContent,
  newCsvContent,
  scheme,
  skipHeaderRows = KEYWORD_DIFF_SKIP_HEADER_ROWS,
  pathSeparator = KEYWORD_PATH_SEPARATOR
}) => {
  const oldRecords = parseCsvContent(oldCsvContent, {
    scheme,
    skipHeaderRows,
    pathSeparator
  })
  const newRecords = parseCsvContent(newCsvContent, {
    scheme,
    skipHeaderRows,
    pathSeparator
  })
  const addedKeywords = new Map()
  const removedKeywords = new Map()
  const changedKeywords = new Map()

  Array.from(newRecords.entries()).forEach(([uuid, newRecord]) => {
    const oldRecord = oldRecords.get(uuid)

    if (oldRecord === undefined) {
      addedKeywords.set(uuid, {
        oldPath: undefined,
        newPath: newRecord.path,
        newKeywordObject: newRecord.keywordObject
      })

      return
    }

    if (JSON.stringify(oldRecord) !== JSON.stringify(newRecord)) {
      changedKeywords.set(uuid, {
        oldPath: oldRecord.path,
        newPath: newRecord.path,
        oldKeywordObject: oldRecord.keywordObject,
        newKeywordObject: newRecord.keywordObject
      })
    }
  })

  Array.from(oldRecords.entries()).forEach(([uuid, oldRecord]) => {
    if (!newRecords.has(uuid)) {
      removedKeywords.set(uuid, {
        oldPath: oldRecord.path,
        newPath: undefined,
        oldKeywordObject: oldRecord.keywordObject
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

export const createKeywordEvents = (keywordChangesMap) => {
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
        NewKeywordObject: pathInfo.newKeywordObject,
        Timestamp: timestamp,
        MetadataSpecification: metadataSpecification
      })
    })

    removedKeywords.forEach((pathInfo, uuid) => {
      keywordEvents.push({
        EventType: 'DELETED',
        Scheme: scheme,
        UUID: uuid,
        OldKeywordObject: pathInfo.oldKeywordObject,
        Timestamp: timestamp,
        MetadataSpecification: metadataSpecification
      })
    })

    changedKeywords.forEach((pathInfo, uuid) => {
      keywordEvents.push({
        EventType: 'UPDATED',
        Scheme: scheme,
        UUID: uuid,
        OldKeywordObject: pathInfo.oldKeywordObject,
        NewKeywordObject: pathInfo.newKeywordObject,
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
      newCsvContent: draftCsv,
      scheme: notation
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
      newCsvContent: '',
      scheme: notation
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
    newCsvContent: draftCsv,
    scheme: notation
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
 *     addedKeywords: Map<string, {
 *       oldPath: undefined,
 *       newPath: string,
 *       newKeywordObject: Record<string, string>|undefined
 *     }>,
 *     removedKeywords: Map<string, {
 *       oldPath: string,
 *       newPath: undefined,
 *       oldKeywordObject: Record<string, string>|undefined
 *     }>,
 *     changedKeywords: Map<string, {
 *       oldPath: string,
 *       newPath: string,
 *       oldKeywordObject: Record<string, string>|undefined,
 *       newKeywordObject: Record<string, string>|undefined
 *     }>
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
 * //   keywordChangesMap: Map([['platforms', comparison]]),
 * //   keywordEvents: [
 * //     {
 * //       EventType: 'UPDATED',
 * //       Scheme: 'platforms',
 * //       UUID: 'uuid-1',
 * //       OldKeywordObject: {
 * //         Basis: 'Space-based Platforms',
 * //         Category: 'Earth Observation Satellites',
 * //         SubCategory: '',
 * //         ShortName: 'GOSAT',
 * //         LongName: 'Greenhouse Gases Observing Satellite'
 * //       },
 * //       NewKeywordObject: {
 * //         Basis: 'Space-based Platforms',
 * //         Category: 'Earth Observation Satellites',
 * //         SubCategory: '',
 * //         ShortName: 'GOSAT - Test1',
 * //         LongName: 'Greenhouse Gases Observing Satellite'
 * //       },
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
