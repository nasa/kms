import { createPublishedConceptResponseCacheKeyByUuid } from '../redisCacheKeys'
import { getCachedJsonResponse } from '../redisCacheStore'

import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'
import { parseCachedConceptResponse } from './helpers/parseCachedConceptResponse'

const defaultContext = {
  cachedJsonResponseReader: getCachedJsonResponse
}

/**
 * Looks up a published concept response by uuid from the Redis published cache.
 *
 * @param {object} params - Published lookup inputs.
 * @param {string} params.uuid - Published keyword uuid.
 * @param {string} params.scheme - KMS keyword scheme.
 * @param {{ cachedJsonResponseReader?: Function }} [context=defaultContext] - Injectable cache reader context for tests.
 * @returns {Promise<object|undefined>} Parsed published concept response, typically containing
 * `uuid`, `fullPath` or `shortName`, and parser-derived keyword fields when available.
 * @throws {Error} When `uuid` or `scheme` is missing.
 *
 * @example
 * // Request
 * const concept = await getPublishedConceptByUuid({
 *   uuid: '2e5a401b-1507-4f57-82b8-36557c13b154',
 *   scheme: 'sciencekeywords'
 * })
 *
 * // Response
 * // {
 * //   uuid: '2e5a401b-1507-4f57-82b8-36557c13b154',
 * //   fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS',
 * //   keywordObject: {
 * //     Category: 'EARTH SCIENCE',
 * //     Topic: 'ATMOSPHERE',
 * //     Term: 'AEROSOLS'
 * //   }
 * // }
 */
export const getPublishedConceptByUuid = async (
  {
    uuid,
    scheme
  },
  context = defaultContext
) => {
  if (!uuid) {
    throw new Error('Missing uuid for published concept lookup')
  }

  if (!scheme) {
    throw new Error('Missing scheme for published concept lookup')
  }

  const normalizedScheme = normalizeKeywordScheme(scheme)
  const cachedResponse = await context.cachedJsonResponseReader({
    cacheKey: createPublishedConceptResponseCacheKeyByUuid({
      uuid,
      scheme: normalizedScheme
    }),
    entityLabel: 'Published Concept by uuid'
  })

  return parseCachedConceptResponse({
    cachedResponse,
    scheme: normalizedScheme
  })
}
