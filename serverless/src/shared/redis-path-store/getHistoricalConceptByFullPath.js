import { createConceptResponseCacheKeyByFullPath } from '../redisCacheKeys'
import { getCachedJsonResponse } from '../redisCacheStore'

import { HISTORICAL_CACHE_FULL_PATH_SCHEME_SET } from './helpers/constants'
import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'
import { parseCachedConceptResponse } from './helpers/parseCachedConceptResponse'

const defaultContext = {
  cachedJsonResponseReader: getCachedJsonResponse
}

/**
 * Looks up a historical concept response by its full path from the Redis historical cache.
 *
 * @param {object} params - Historical lookup inputs.
 * @param {string} params.fullPath - Historical keyword full path.
 * @param {string} params.scheme - KMS keyword scheme.
 * @param {boolean} [params.bypassCache=false] - Whether to bypass the cached response reader.
 * @param {{ cachedJsonResponseReader?: Function }} [context=defaultContext] - Injectable cache reader context for tests.
 * @returns {Promise<object|undefined>} Parsed historical concept response, typically containing
 * fields such as `uuid`, `fullPath`, and any keyword-object enrichments the parser attaches.
 * @throws {Error} When `fullPath` or `scheme` is missing, or the scheme does not support
 * historical full-path lookup.
 *
 * @example
 * // Request
 * const concept = await getHistoricalConceptByFullPath({
 *   fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS',
 *   scheme: 'sciencekeywords'
 * })
 *
 * // Response
 * // {
 * //   uuid: '2e5a401b-1507-4f57-82b8-36557c13b154',
 * //   fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS > LEGACY AEROSOLS',
 * //   keywordObject: {
 * //     Category: 'EARTH SCIENCE',
 * //     Topic: 'ATMOSPHERE',
 * //     Term: 'AEROSOLS',
 * //     VariableLevel1: 'LEGACY AEROSOLS'
 * //   }
 * // }
 */
export const getHistoricalConceptByFullPath = async (
  {
    fullPath,
    scheme,
    bypassCache = false
  },
  context = defaultContext
) => {
  if (!fullPath) {
    throw new Error('Missing full path for historical concept lookup')
  }

  if (!scheme) {
    throw new Error('Missing scheme for historical concept lookup')
  }

  const normalizedScheme = normalizeKeywordScheme(scheme)

  if (!HISTORICAL_CACHE_FULL_PATH_SCHEME_SET.has(normalizedScheme)) {
    throw new Error(`Historical fullPath lookup is not supported for scheme=${normalizedScheme}`)
  }

  const cachedResponse = await context.cachedJsonResponseReader({
    cacheKey: createConceptResponseCacheKeyByFullPath({
      fullPath: fullPath.toLowerCase(),
      scheme: normalizedScheme
    }),
    entityLabel: 'Historical Concept by fullPath',
    bypassCache
  })

  return parseCachedConceptResponse({
    cachedResponse,
    scheme: normalizedScheme
  })
}
