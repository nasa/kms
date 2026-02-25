import { parse } from 'csv/sync'

/**
 * Parses concept-scheme CSV output into full-path values.
 *
 * @param {string} csvBody - Raw CSV response body.
 * @returns {string[]} Full path values.
 */
const parseCsvFullPaths = (csvBody) => {
  if (!csvBody) return []

  try {
    const records = parse(csvBody, {
      skip_empty_lines: true,
      relax_column_count: true
    })

    if (!Array.isArray(records) || records.length < 3) return []

    return records
      .slice(2)
      .map((row) => row.filter((value) => value).join('|'))
      .filter((value) => Boolean(value))
  } catch (error) {
    console.error(`Cache prime failed parsing CSV full paths, error=${error}`)

    return []
  }
}

/**
 * Primes /concept/full_path cache keys by sourcing full paths from scheme CSV pages.
 *
 * @param {Object} params - Prime parameters.
 * @param {Object[]} params.schemes - Concept schemes.
 * @param {Function} params.getConcepts - getConcepts handler function.
 * @param {Function} params.getConcept - getConcept handler function.
 * @param {Function} params.createConceptCacheKeyFromEvent - Concept cache key creator.
 * @param {string[]} params.formats - Response formats to warm for /concept/full_path.
 * @param {number} params.maxFullPaths - Max full paths to warm this run.
 * @param {string} params.primeVersion - Version being primed.
 * @param {number} params.pageSize - Page size for paging requests.
 * @returns {Promise<{schemeCsvSettled: PromiseSettledResult[], limitedFullPathWarmEntries: Object[], fullPathSettled: PromiseSettledResult[]}>}
 */
export const primeFullPaths = async ({
  schemes,
  getConcepts,
  getConcept,
  createConceptCacheKeyFromEvent,
  formats = ['rdf', 'json'],
  maxFullPaths,
  primeVersion,
  pageSize
}) => {
  const createFullPathWarmEntry = (fullPathValue, format) => ({
    label: `/concept/full_path/${fullPathValue}?format=${format}`,
    event: {
      resource: '/concept/full_path/{fullPath+}',
      path: `/concept/full_path/${encodeURIComponent(fullPathValue)}`,
      pathParameters: {
        fullPath: encodeURIComponent(fullPathValue)
      },
      queryStringParameters: {
        version: primeVersion,
        format
      }
    },
    cacheKey: null
  })

  const schemeCsvSettled = await schemes.reduce(async (accPromise, scheme) => {
    const acc = await accPromise
    try {
      const csvPageOneEvent = {
        resource: '/concepts/concept_scheme/{conceptScheme}',
        path: `/concepts/concept_scheme/${scheme.notation}`,
        pathParameters: {
          conceptScheme: scheme.notation
        },
        queryStringParameters: {
          version: primeVersion,
          page_num: '1',
          page_size: String(pageSize),
          format: 'csv'
        }
      }

      const firstCsvResponse = await getConcepts(csvPageOneEvent, {})
      const totalPages = 1

      const fullPathValues = [
        ...parseCsvFullPaths(firstCsvResponse?.body)
      ]
      const pagesWithData = 1
      const pagesAttempted = pagesWithData
      console.log(`[cache-prime] summary full-paths scheme=${scheme.notation} totalPages=${totalPages} attemptedPages=${pagesAttempted} pagesWithData=${pagesWithData} csvPaths=${fullPathValues.length}`)

      const fullPathEntries = fullPathValues.flatMap((value) => (
        formats.map((format) => {
          const entry = createFullPathWarmEntry(value, format)

          return {
            ...entry,
            cacheKey: createConceptCacheKeyFromEvent(entry.event)
          }
        })
      ))
      acc.push({
        status: 'fulfilled',
        value: fullPathEntries
      })
    } catch (error) {
      acc.push({
        status: 'rejected',
        reason: error
      })
    }

    return acc
  }, Promise.resolve([]))

  const fullPathWarmEntries = schemeCsvSettled
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
  const limitedFullPathWarmEntries = fullPathWarmEntries.slice(0, maxFullPaths)

  const fullPathSettled = await limitedFullPathWarmEntries.reduce(async (accPromise, entry) => {
    const acc = await accPromise
    try {
      // Synchronous fetch to avoid fan-out pressure while priming.
      const response = await getConcept(entry.event, {})
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
    schemeCsvSettled,
    limitedFullPathWarmEntries,
    fullPathSettled
  }
}
