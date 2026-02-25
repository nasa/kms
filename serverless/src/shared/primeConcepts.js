import { logger } from '@/shared/logger'

/**
 * Primes /concepts and /concepts/concept_scheme routes for the given schemes.
 *
 * @param {Object} params - Prime parameters.
 * @param {Object[]} params.schemes - Concept schemes.
 * @param {Function} params.getConcepts - getConcepts handler function.
 * @param {Function} params.createConceptsCacheKeyFromEvent - Cache key creator.
 * @param {Function} params.getTotalPagesFromResponse - Total page calculator.
 * @param {string[]} params.formats - Response formats to warm.
 * @param {string} params.primeVersion - Version being primed.
 * @param {number} params.pageSize - Page size for paging requests.
 * @returns {Promise<{warmSettled: PromiseSettledResult[], schemeSettled: PromiseSettledResult[]}>}
 */
export const primeConcepts = async ({
  schemes,
  getConcepts,
  createConceptsCacheKeyFromEvent,
  getTotalPagesFromResponse,
  formats,
  primeVersion,
  pageSize
}) => {
  const rootEvent = {
    resource: '/concepts',
    path: '/concepts'
  }

  const warmList = formats.map((format) => {
    const event = {
      ...rootEvent,
      queryStringParameters: {
        version: primeVersion,
        page_num: '1',
        page_size: String(pageSize),
        format
      }
    }

    return {
      event,
      label: `/concepts?format=${format}`,
      cacheKey: createConceptsCacheKeyFromEvent(event)
    }
  })

  const schemeFormatPairs = schemes.flatMap((scheme) => (
    formats.map((format) => ({
      schemeName: scheme.notation,
      format
    }))
  ))

  const schemeSettled = await schemeFormatPairs.reduce(async (
    accPromise,
    { schemeName, format }
  ) => {
    const acc = await accPromise
    try {
      const firstEntry = {
        label: `/concepts/concept_scheme/${schemeName}?format=${format}&page_num=1`,
        event: {
          resource: '/concepts/concept_scheme/{conceptScheme}',
          path: `/concepts/concept_scheme/${schemeName}`,
          pathParameters: {
            conceptScheme: schemeName
          },
          queryStringParameters: {
            version: primeVersion,
            page_num: '1',
            page_size: String(pageSize),
            format
          }
        },
        cacheKey: null
      }
      const firstEntryWithKey = {
        ...firstEntry,
        cacheKey: createConceptsCacheKeyFromEvent(firstEntry.event)
      }

      const firstResponse = await getConcepts(firstEntry.event, {})
      const totalPages = getTotalPagesFromResponse(firstResponse)
      const firstResponseEntry = {
        entry: firstEntryWithKey,
        response: firstResponse
      }
      const additionalResponses = await Array.from(
        { length: Math.max(totalPages - 1, 0) },
        (_, index) => index + 2
      ).reduce(async (responsesPromise, pageNum) => {
        const responses = await responsesPromise
        const entry = {
          label: `/concepts/concept_scheme/${schemeName}?format=${format}&page_num=${pageNum}`,
          event: {
            resource: '/concepts/concept_scheme/{conceptScheme}',
            path: `/concepts/concept_scheme/${schemeName}`,
            pathParameters: {
              conceptScheme: schemeName
            },
            queryStringParameters: {
              version: primeVersion,
              page_num: String(pageNum),
              page_size: String(pageSize),
              format
            }
          },
          cacheKey: null
        }
        const entryWithCacheKey = {
          ...entry,
          cacheKey: createConceptsCacheKeyFromEvent(entry.event)
        }

        const response = await getConcepts(entry.event, {})
        responses.push({
          entry: entryWithCacheKey,
          response
        })

        return responses
      }, Promise.resolve([]))
      const pagesWithData = 1 + additionalResponses.length
      const pagesAttempted = pagesWithData
      logger.info(`[cache-prime] summary concepts scheme=${schemeName} format=${format} totalPages=${totalPages} attemptedPages=${pagesAttempted} pagesWithData=${pagesWithData}`)

      acc.push({
        status: 'fulfilled',
        value: [firstResponseEntry, ...additionalResponses]
      })
    } catch (error) {
      acc.push({
        status: 'rejected',
        reason: error
      })
    }

    return acc
  }, Promise.resolve([]))

  const warmSettled = await warmList.reduce(async (accPromise, entry) => {
    const acc = await accPromise
    try {
      const response = await getConcepts(entry.event, {})
      acc.push({
        status: 'fulfilled',
        value: {
          entry,
          response
        }
      })
    } catch (error) {
      acc.push({
        status: 'rejected',
        reason: error
      })
    }

    return acc
  }, Promise.resolve([]))

  return {
    warmSettled,
    schemeSettled
  }
}
