import {
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName
} from '../redisCacheKeys'
import { getCachedJsonResponse } from '../redisCacheStore'

import {
  getFullPathLookupValueFromKeywordObject
} from './helpers/getFullPathLookupValueFromKeywordObject'
import {
  getShortNameLookupValueFromKeywordObject
} from './helpers/getShortNameLookupValueFromKeywordObject'
import { isLookupFullPathScheme } from './helpers/isLookupFullPathScheme'
import { isLookupShortNameScheme } from './helpers/isLookupShortNameScheme'
import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'
import { parseCachedConceptResponse } from './helpers/parseCachedConceptResponse'
import { resolveLookupKeywordObject } from './helpers/resolveLookupKeywordObject'

const defaultContext = {
  cachedJsonResponseReader: getCachedJsonResponse
}

/**
 * Resolves a published concept from a keyword object or keyword value using the published cache.
 *
 * Full-path schemes use the full-path cache, short-name schemes use the short-name cache, and
 * unsupported schemes return `undefined`.
 *
 * @param {object} params - Published keyword lookup inputs.
 * @param {string} params.scheme - KMS keyword scheme.
 * @param {Record<string, string>} [params.keywordObject] - Normalized keyword object.
 * @param {unknown} [params.keywordValue] - Legacy/alternate keyword value input normalized by the helper.
 * @param {{ cachedJsonResponseReader?: Function }} [context=defaultContext] - Injectable cache reader context for tests.
 * @returns {Promise<object|undefined>} Parsed published concept response or `undefined` when the
 * scheme/value combination does not produce a lookup key.
 *
 * @example
 * // Request
 * const concept = await getPublishedConceptByKeyword({
 *   scheme: 'sciencekeywords',
 *   keywordObject: {
 *     Category: 'EARTH SCIENCE',
 *     Topic: 'ATMOSPHERE',
 *     Term: 'AEROSOLS'
 *   }
 * })
 *
 * // Response
 * // {
 * //   uuid: '2e5a401b-1507-4f57-82b8-36557c13b154',
 * //   fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
 * // }
 */
export const getPublishedConceptByKeyword = async (
  {
    scheme,
    keywordObject,
    keywordValue
  },
  context = defaultContext
) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const normalizedKeywordObject = resolveLookupKeywordObject({
    scheme: normalizedScheme,
    keywordObject,
    keywordValue
  })

  if (isLookupFullPathScheme(normalizedScheme)) {
    const fullPath = getFullPathLookupValueFromKeywordObject({
      scheme: normalizedScheme,
      keywordObject: normalizedKeywordObject
    })

    if (!fullPath) {
      return undefined
    }

    const cachedResponse = await context.cachedJsonResponseReader({
      cacheKey: createPublishedConceptResponseCacheKeyByFullPath({
        fullPath: fullPath.toLowerCase(),
        scheme: normalizedScheme
      }),
      entityLabel: 'Published Concept by fullPath'
    })

    return parseCachedConceptResponse({
      cachedResponse,
      scheme: normalizedScheme
    })
  }

  if (isLookupShortNameScheme(normalizedScheme)) {
    const shortName = getShortNameLookupValueFromKeywordObject(normalizedKeywordObject)

    if (!shortName) {
      return undefined
    }

    const cachedResponse = await context.cachedJsonResponseReader({
      cacheKey: createPublishedConceptResponseCacheKeyByShortName({
        shortName: shortName.toLowerCase(),
        scheme: normalizedScheme
      }),
      entityLabel: 'Published Concept by shortName'
    })

    return parseCachedConceptResponse({
      cachedResponse,
      scheme: normalizedScheme
    })
  }

  return undefined
}
