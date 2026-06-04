import { getCachedJsonResponse } from '../redisCacheStore'

import { getHistoricalConceptByFullPath } from './getHistoricalConceptByFullPath'
import { getHistoricalConceptByShortName } from './getHistoricalConceptByShortName'
import {
  getFullPathLookupValueFromKeywordObject
} from './helpers/getFullPathLookupValueFromKeywordObject'
import {
  getShortNameLookupValueFromKeywordObject
} from './helpers/getShortNameLookupValueFromKeywordObject'
import { isLookupFullPathScheme } from './helpers/isLookupFullPathScheme'
import { isLookupShortNameScheme } from './helpers/isLookupShortNameScheme'
import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'
import { resolveLookupKeywordObject } from './helpers/resolveLookupKeywordObject'

const defaultContext = {
  cachedJsonResponseReader: getCachedJsonResponse
}

/**
 * Resolves a historical concept from a keyword object or keyword value using the appropriate
 * historical cache strategy for the scheme.
 *
 * Full-path schemes route to `getHistoricalConceptByFullPath`, short-name schemes route to
 * `getHistoricalConceptByShortName`, and unsupported schemes return `undefined`.
 *
 * @param {object} params - Historical keyword lookup inputs.
 * @param {string} params.scheme - KMS keyword scheme.
 * @param {Record<string, string>} [params.keywordObject] - Normalized keyword object.
 * @param {unknown} [params.keywordValue] - Legacy/alternate keyword value input normalized by the helper.
 * @param {{ cachedJsonResponseReader?: Function }} [context=defaultContext] - Injectable cache reader context for tests.
 * @returns {Promise<object|undefined>} Parsed historical concept response or `undefined` when the
 * scheme/value combination does not produce a lookup key.
 *
 * @example
 * // Request
 * const concept = await getHistoricalConceptByKeyword({
 *   scheme: 'platforms',
 *   keywordObject: {
 *     Class: 'Space-based Platforms',
 *     Type: 'Earth Observation Satellites',
 *     ShortName: 'Aqua Legacy'
 *   }
 * })
 *
 * // Response
 * // {
 * //   uuid: 'ea7fd15d-190d-43f3-bdd3-75f5d88dc3f8',
 * //   shortName: 'Aqua Legacy',
 * //   longName: 'Aqua Legacy'
 * // }
 */
export const getHistoricalConceptByKeyword = async (
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

    return getHistoricalConceptByFullPath({
      fullPath,
      scheme: normalizedScheme
    }, context)
  }

  if (isLookupShortNameScheme(normalizedScheme)) {
    const shortName = getShortNameLookupValueFromKeywordObject(normalizedKeywordObject)

    if (!shortName) {
      return undefined
    }

    return getHistoricalConceptByShortName({
      shortName,
      scheme: normalizedScheme
    }, context)
  }

  return undefined
}
