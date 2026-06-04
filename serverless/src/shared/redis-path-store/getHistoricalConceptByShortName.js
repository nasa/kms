import { createConceptResponseCacheKeyByShortName } from '../redisCacheKeys'
import { getCachedJsonResponse } from '../redisCacheStore'

import { HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET } from './helpers/constants'
import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'
import { parseCachedConceptResponse } from './helpers/parseCachedConceptResponse'

const defaultContext = {
  cachedJsonResponseReader: getCachedJsonResponse
}

/**
 * Looks up a historical concept response by short name from the Redis historical cache.
 *
 * @param {object} params - Historical lookup inputs.
 * @param {string} params.shortName - Historical keyword short name.
 * @param {string} params.scheme - KMS keyword scheme.
 * @param {boolean} [params.bypassCache=false] - Whether to bypass the cached response reader.
 * @param {{ cachedJsonResponseReader?: Function }} [context=defaultContext] - Injectable cache reader context for tests.
 * @returns {Promise<object|undefined>} Parsed historical concept response, typically containing
 * `uuid`, `shortName`, `longName`, and parser-derived keyword fields when available.
 * @throws {Error} When `shortName` or `scheme` is missing, or the scheme does not support
 * historical short-name lookup.
 *
 * @example
 * // Request
 * const concept = await getHistoricalConceptByShortName({
 *   shortName: 'Aqua Legacy',
 *   scheme: 'platforms'
 * })
 *
 * // Response
 * // {
 * //   uuid: 'ea7fd15d-190d-43f3-bdd3-75f5d88dc3f8',
 * //   shortName: 'Aqua Legacy',
 * //   longName: 'Aqua Legacy',
 * //   keywordObject: {
 * //     Category: 'Platforms',
 * //     Class: 'Space-based Platforms',
 * //     Type: 'Earth Observation Satellites',
 * //     ShortName: 'Aqua Legacy'
 * //   }
 * // }
 */
export const getHistoricalConceptByShortName = async (
  {
    shortName,
    scheme,
    bypassCache = false
  },
  context = defaultContext
) => {
  if (!shortName) {
    throw new Error('Missing short name for historical concept lookup')
  }

  if (!scheme) {
    throw new Error('Missing scheme for historical concept lookup')
  }

  const normalizedScheme = normalizeKeywordScheme(scheme)

  if (!HISTORICAL_CACHE_SHORT_NAME_SCHEME_SET.has(normalizedScheme)) {
    throw new Error(`Historical shortName lookup is not supported for scheme=${normalizedScheme}`)
  }

  const cachedResponse = await context.cachedJsonResponseReader({
    cacheKey: createConceptResponseCacheKeyByShortName({
      shortName: shortName.toLowerCase(),
      scheme: normalizedScheme
    }),
    entityLabel: 'Historical Concept by shortName',
    bypassCache
  })

  return parseCachedConceptResponse({
    cachedResponse,
    scheme: normalizedScheme
  })
}
