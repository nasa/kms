import {
  buildKeywordPathFromObject,
  buildKeywordPathObjectFromPath,
  getKeywordPathSlotFields,
  hasKeywordPathObjectValue,
  isLookupFullPathScheme,
  isLookupShortNameScheme,
  normalizeKeywordScheme,
  splitKeywordPath,
  trimKeywordPathSegment
} from './keywordPaths'
import {
  createConceptResponseCacheKeyByFullPath,
  createConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByFullPath,
  createPublishedConceptResponseCacheKeyByShortName,
  createPublishedConceptResponseCacheKeyByUuid
} from './redisCacheKeys'
import { getCachedJsonResponse } from './redisCacheStore'

/**
 * Picks the leaf-most non-blank segment from a split keyword path.
 *
 * @param {string[]} [segments=[]] - Split keyword path segments.
 * @returns {string} Last non-blank segment, or an empty string when none exist.
 *
 * @example
 * getLastNonEmptySegment(['EARTH SCIENCE', 'ATMOSPHERE', '', 'AEROSOLS'])
 * // 'AEROSOLS'
 */
const getLastNonEmptySegment = (segments = []) => [...segments]
  .reverse()
  .find((segment) => trimKeywordPathSegment(segment).length > 0) || ''

/**
 * Removes a redundant leading scheme label from a path segment array.
 *
 * @param {object} params - Path normalization parameters.
 * @param {string} params.normalizedScheme - Lowercased KMS scheme name.
 * @param {string[]} [params.pathSegments=[]] - Split keyword path segments.
 * @returns {string[]} Path segments without the leading scheme label when present.
 *
 * @example
 * stripLeadingSchemeLabel({
 *   normalizedScheme: 'sciencekeywords',
 *   pathSegments: ['Science Keywords', 'EARTH SCIENCE', 'ATMOSPHERE']
 * })
 * // ['EARTH SCIENCE', 'ATMOSPHERE']
 */
const stripLeadingSchemeLabel = ({
  normalizedScheme,
  pathSegments = []
}) => {
  const firstSegment = trimKeywordPathSegment(pathSegments[0]).toLowerCase()

  if (
    firstSegment === normalizedScheme
    || (
      normalizedScheme === 'sciencekeywords'
      && firstSegment === 'science keywords'
    )
  ) {
    return pathSegments.slice(1)
  }

  return pathSegments
}

/**
 * Rebuilds a short-name scheme keyword object from path segments.
 *
 * @param {object} params - Conversion parameters.
 * @param {string} params.normalizedScheme - Lowercased KMS scheme name.
 * @param {string[]} [params.pathSegments=[]] - Split keyword path segments.
 * @returns {Record<string, string>} Canonical keyword object for the short-name scheme.
 *
 * @example
 * buildKeywordObjectForShortNameScheme({
 *   normalizedScheme: 'platforms',
 *   pathSegments: ['Space-based Platforms', 'Earth Observation Satellites', '', 'SPOT-4']
 * })
 * // {
 * //   PathSegments: ['Space-based Platforms', 'Earth Observation Satellites', '', 'SPOT-4'],
 * //   Class: 'Space-based Platforms',
 * //   Type: 'Earth Observation Satellites',
 * //   ShortName: 'SPOT-4'
 * // }
 */
const buildKeywordObjectForShortNameScheme = ({
  normalizedScheme,
  pathSegments = []
}) => {
  const keywordObject = {
    PathSegments: pathSegments.map((segment) => trimKeywordPathSegment(segment))
  }
  const normalizedSegments = stripLeadingSchemeLabel({
    normalizedScheme,
    pathSegments
  })

  switch (normalizedScheme) {
    case 'platforms': {
      if (normalizedSegments.length >= 4) {
        return {
          ...keywordObject,
          Class: normalizedSegments[0] || '',
          Type: normalizedSegments[1] || '',
          ShortName: normalizedSegments[3] || ''
        }
      }

      if (normalizedSegments.length === 3) {
        return {
          ...keywordObject,
          Class: normalizedSegments[0] || '',
          Type: normalizedSegments[1] || '',
          ShortName: normalizedSegments[2] || ''
        }
      }

      return {
        ...keywordObject,
        ShortName: getLastNonEmptySegment(normalizedSegments)
      }
    }

    case 'idnnode':
      return {
        ...keywordObject,
        ShortName: trimKeywordPathSegment(normalizedSegments.join(' > '))
      }
    default:
      return {
        ...keywordObject,
        ShortName: getLastNonEmptySegment(normalizedSegments)
      }
  }
}

/**
 * Converts a path-shaped keyword into the object form used internally by correction code.
 *
 * @param {object} params - Conversion parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {string} params.keywordPath - Canonical KMS path string.
 * @returns {Record<string, string>} Canonical keyword object.
 *
 * @example
 * buildKeywordObjectFromPath({
 *   scheme: 'sciencekeywords',
 *   keywordPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
 * })
 * // {
 * //   PathSegments: ['EARTH SCIENCE', 'ATMOSPHERE', 'AEROSOLS', '', '', '', ''],
 * //   Category: 'EARTH SCIENCE',
 * //   Topic: 'ATMOSPHERE',
 * //   Term: 'AEROSOLS',
 * //   VariableLevel1: '',
 * //   VariableLevel2: '',
 * //   VariableLevel3: '',
 * //   DetailedVariable: ''
 * // }
 */
export const buildKeywordObjectFromPath = ({
  scheme,
  keywordPath
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const normalizedKeywordPath = trimKeywordPathSegment(keywordPath)

  if (normalizedKeywordPath.length === 0) {
    return {}
  }

  const slotFields = getKeywordPathSlotFields(normalizedScheme)

  if (Array.isArray(slotFields)) {
    return {
      PathSegments: splitKeywordPath(normalizedKeywordPath),
      ...buildKeywordPathObjectFromPath({
        scheme: normalizedScheme,
        keywordPath: stripLeadingSchemeLabel({
          normalizedScheme,
          pathSegments: splitKeywordPath(normalizedKeywordPath)
        }).join(' > ')
      })
    }
  }

  if (isLookupShortNameScheme(normalizedScheme)) {
    return buildKeywordObjectForShortNameScheme({
      normalizedScheme,
      pathSegments: splitKeywordPath(normalizedKeywordPath)
    })
  }

  return {
    Value: normalizedKeywordPath
  }
}

/**
 * Attaches a canonical keyword object to a cached concept payload when it is missing.
 *
 * @param {object} params - Attachment parameters.
 * @param {object|undefined} params.concept - Cached concept payload.
 * @param {string} params.scheme - KMS scheme name.
 * @returns {object|undefined} Concept payload with `keywordObject` attached when possible.
 *
 * @example
 * attachKeywordObjectToConcept({
 *   scheme: 'projects',
 *   concept: {
 *     uuid: 'uuid-1',
 *     fullPath: 'SPURS-2'
 *   }
 * })
 * // { uuid: 'uuid-1', fullPath: 'SPURS-2', keywordObject: { PathSegments: ['SPURS-2'], ShortName: 'SPURS-2' } }
 */
const attachKeywordObjectToConcept = ({
  concept,
  scheme
}) => {
  if (!concept) {
    return undefined
  }

  if (concept.keywordObject && typeof concept.keywordObject === 'object') {
    return concept
  }

  return {
    ...concept,
    keywordObject: buildKeywordObjectFromPath({
      scheme,
      keywordPath: concept.fullPath
    })
  }
}

/**
 * Ensures correction payloads always carry normalized keyword objects.
 *
 * This preserves compatibility with older callers that may still send `oldKeywordPath` /
 * `newKeywordPath`, while letting newer callers stay object-first.
 *
 * @param {object} [correction={}] - Correction descriptor to normalize.
 * @returns {object} Correction descriptor with `oldKeywordObject` and `newKeywordObject`.
 *
 * @example
 * ensureCorrectionKeywordObjects({
 *   scheme: 'projects',
 *   oldKeywordPath: 'OLD-PROJECT',
 *   newKeywordPath: 'NEW-PROJECT'
 * })
 * // {
 * //   scheme: 'projects',
 * //   oldKeywordPath: 'OLD-PROJECT',
 * //   newKeywordPath: 'NEW-PROJECT',
 * //   oldKeywordObject: { PathSegments: ['OLD-PROJECT'], ShortName: 'OLD-PROJECT' },
 * //   newKeywordObject: { PathSegments: ['NEW-PROJECT'], ShortName: 'NEW-PROJECT' }
 * // }
 */
export const ensureCorrectionKeywordObjects = (correction = {}) => {
  const normalizedScheme = normalizeKeywordScheme(correction.scheme)

  return {
    ...correction,
    oldKeywordObject: correction.oldKeywordObject || buildKeywordObjectFromPath({
      scheme: normalizedScheme,
      keywordPath: correction.oldKeywordPath
    }),
    newKeywordObject: correction.newKeywordObject || buildKeywordObjectFromPath({
      scheme: normalizedScheme,
      keywordPath: correction.newKeywordPath
    })
  }
}

/**
 * Converts a keyword object back into the canonical path string used at Redis boundaries.
 *
 * @param {object} params - Conversion parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {Record<string, string>} [params.keywordObject={}] - Canonical keyword object.
 * @returns {string} Canonical KMS path string.
 *
 * @example
 * buildKeywordPathFromKeywordObject({
 *   scheme: 'platforms',
 *   keywordObject: {
 *     PathSegments: ['Space-based Platforms', 'Earth Observation Satellites', '', 'SPOT-4'],
 *     Class: 'Space-based Platforms',
 *     Type: 'Earth Observation Satellites',
 *     ShortName: 'SPOT-4'
 *   }
 * })
 * // 'Space-based Platforms > Earth Observation Satellites >  > SPOT-4'
 */
export const buildKeywordPathFromKeywordObject = ({
  scheme,
  keywordObject = {}
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const pathSegments = Array.isArray(keywordObject.PathSegments)
    ? keywordObject.PathSegments.map((segment) => trimKeywordPathSegment(segment))
    : []

  if (pathSegments.length > 0) {
    return pathSegments.join(' > ')
  }

  const slotFields = getKeywordPathSlotFields(normalizedScheme)

  if (Array.isArray(slotFields)) {
    return buildKeywordPathFromObject({
      scheme: normalizedScheme,
      keywordObject
    })
  }

  if (isLookupShortNameScheme(normalizedScheme)) {
    if (normalizedScheme === 'platforms') {
      return [
        keywordObject.Class,
        keywordObject.Type,
        keywordObject.ShortName
      ].map((segment) => trimKeywordPathSegment(segment)).join(' > ')
    }

    return trimKeywordPathSegment(keywordObject.ShortName)
  }

  return trimKeywordPathSegment(keywordObject.Value)
}

/**
 * Parses a cached Redis concept response and enriches it with a keyword object.
 *
 * @param {object} params - Parse parameters.
 * @param {{ body?: string }|undefined} params.cachedResponse - Cached Redis response wrapper.
 * @param {string} params.scheme - KMS scheme name.
 * @returns {object|undefined} Parsed concept payload when the cache contains a body.
 *
 * @example
 * parseCachedConceptResponse({
 *   scheme: 'projects',
 *   cachedResponse: {
 *     body: JSON.stringify({ uuid: 'uuid-1', fullPath: 'SPURS-2' })
 *   }
 * })
 * // { uuid: 'uuid-1', fullPath: 'SPURS-2', keywordObject: { PathSegments: ['SPURS-2'], ShortName: 'SPURS-2' } }
 */
const parseCachedConceptResponse = ({
  cachedResponse,
  scheme
}) => {
  if (!cachedResponse?.body) {
    return undefined
  }

  return attachKeywordObjectToConcept({
    concept: JSON.parse(cachedResponse.body),
    scheme
  })
}

/**
 * Derives the full-path cache lookup string from a normalized keyword object.
 *
 * @param {object} params - Lookup normalization parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {Record<string, string>} [params.keywordObject={}] - Canonical keyword object.
 * @returns {string|undefined} Canonical full-path lookup value.
 *
 * @example
 * getFullPathLookupValueFromKeywordObject({
 *   scheme: 'rucontenttype',
 *   keywordObject: {
 *     URLContentType: 'CollectionURL',
 *     Type: 'PROJECT HOME PAGE',
 *     Subtype: ''
 *   }
 * })
 * // 'CollectionURL > PROJECT HOME PAGE > '
 */
const getFullPathLookupValueFromKeywordObject = ({
  scheme,
  keywordObject = {}
}) => {
  const slotFields = getKeywordPathSlotFields(scheme)

  if (Array.isArray(slotFields)) {
    if (!hasKeywordPathObjectValue(keywordObject)) {
      return undefined
    }

    return buildKeywordPathFromObject({
      scheme,
      keywordObject
    })
  }

  const scalarValue = trimKeywordPathSegment(keywordObject.Value)

  return scalarValue.length > 0 ? scalarValue : undefined
}

/**
 * Derives the short-name cache lookup string from a normalized keyword object.
 *
 * @param {Record<string, string>} [keywordObject={}] - Canonical keyword object.
 * @returns {string|undefined} Short-name lookup value.
 *
 * @example
 * getShortNameLookupValueFromKeywordObject({
 *   ShortName: 'MODIS'
 * })
 * // 'MODIS'
 */
const getShortNameLookupValueFromKeywordObject = (keywordObject = {}) => {
  const shortName = trimKeywordPathSegment(keywordObject.ShortName)

  return shortName.length > 0 ? shortName : undefined
}

/**
 * Reads a historical concept cache entry by canonical full path.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.fullPath - Canonical KMS full path.
 * @param {string} params.scheme - KMS scheme name.
 * @returns {Promise<object|undefined>} Historical concept payload when found.
 *
 * @example
 * const concept = await getHistoricalConceptByFullPath({
 *   scheme: 'sciencekeywords',
 *   fullPath: 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS >  >  >  > '
 * })
 */
export const getHistoricalConceptByFullPath = async ({
  fullPath,
  scheme
}) => {
  if (!fullPath) {
    throw new Error('Missing full path for historical concept lookup')
  }

  if (!scheme) {
    throw new Error('Missing scheme for historical concept lookup')
  }

  const normalizedScheme = normalizeKeywordScheme(scheme)
  const cacheKey = createConceptResponseCacheKeyByFullPath({
    fullPath: fullPath.toLowerCase(),
    scheme: normalizedScheme
  })
  const cachedResponse = await getCachedJsonResponse({
    cacheKey,
    entityLabel: 'Historical Concept by fullPath'
  })

  return parseCachedConceptResponse({
    cachedResponse,
    scheme: normalizedScheme
  })
}

/**
 * Reads a historical concept cache entry by short name.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.shortName - Short-name lookup value.
 * @param {string} params.scheme - KMS scheme name.
 * @returns {Promise<object|undefined>} Historical concept payload when found.
 *
 * @example
 * const concept = await getHistoricalConceptByShortName({
 *   scheme: 'projects',
 *   shortName: 'SPURS-2'
 * })
 */
export const getHistoricalConceptByShortName = async ({
  shortName,
  scheme
}) => {
  if (!shortName) {
    throw new Error('Missing short name for historical concept lookup')
  }

  if (!scheme) {
    throw new Error('Missing scheme for historical concept lookup')
  }

  const normalizedScheme = normalizeKeywordScheme(scheme)
  const cacheKey = createConceptResponseCacheKeyByShortName({
    shortName: shortName.toLowerCase(),
    scheme: normalizedScheme
  })
  const cachedResponse = await getCachedJsonResponse({
    cacheKey,
    entityLabel: 'Historical Concept by shortName'
  })

  return parseCachedConceptResponse({
    cachedResponse,
    scheme: normalizedScheme
  })
}

/**
 * Reads a published concept cache entry by UUID.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.uuid - Published concept UUID.
 * @param {string} params.scheme - KMS scheme name.
 * @returns {Promise<object|undefined>} Published concept payload when found.
 *
 * @example
 * const concept = await getPublishedConceptByUuid({
 *   scheme: 'sciencekeywords',
 *   uuid: '2e5a401b-1507-4f57-82b8-36557c13b154'
 * })
 */
export const getPublishedConceptByUuid = async ({
  uuid,
  scheme
}) => {
  if (!uuid) {
    throw new Error('Missing uuid for published concept lookup')
  }

  if (!scheme) {
    throw new Error('Missing scheme for published concept lookup')
  }

  const normalizedScheme = normalizeKeywordScheme(scheme)
  const cacheKey = createPublishedConceptResponseCacheKeyByUuid({
    uuid,
    scheme: normalizedScheme
  })
  const cachedResponse = await getCachedJsonResponse({
    cacheKey,
    entityLabel: 'Published Concept by uuid'
  })

  return parseCachedConceptResponse({
    cachedResponse,
    scheme: normalizedScheme
  })
}

/**
 * Reads the historical concept cache using a normalized keyword object.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {Record<string, string>} [params.keywordObject={}] - Canonical keyword object.
 * @returns {Promise<object|undefined>} Historical concept payload when found.
 *
 * @example
 * const concept = await getHistoricalConceptByKeyword({
 *   scheme: 'projects',
 *   keywordObject: {
 *     ShortName: 'SPURS-2'
 *   }
 * })
 */
export const getHistoricalConceptByKeyword = async ({
  scheme,
  keywordObject = {}
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)

  if (isLookupFullPathScheme(normalizedScheme)) {
    const fullPath = getFullPathLookupValueFromKeywordObject({
      scheme: normalizedScheme,
      keywordObject
    })

    if (!fullPath) {
      return undefined
    }

    return getHistoricalConceptByFullPath({
      fullPath,
      scheme: normalizedScheme
    })
  }

  if (isLookupShortNameScheme(normalizedScheme)) {
    const shortName = getShortNameLookupValueFromKeywordObject(keywordObject)

    if (!shortName) {
      return undefined
    }

    return getHistoricalConceptByShortName({
      shortName,
      scheme: normalizedScheme
    })
  }

  return undefined
}

/**
 * Reads the published concept cache using a normalized keyword object.
 *
 * @param {object} params - Lookup parameters.
 * @param {string} params.scheme - KMS scheme name.
 * @param {Record<string, string>} [params.keywordObject={}] - Canonical keyword object.
 * @returns {Promise<object|undefined>} Published concept payload when found.
 *
 * @example
 * const concept = await getPublishedConceptByKeyword({
 *   scheme: 'rucontenttype',
 *   keywordObject: {
 *     URLContentType: 'CollectionURL',
 *     Type: 'PROJECT HOME PAGE',
 *     Subtype: ''
 *   }
 * })
 */
export const getPublishedConceptByKeyword = async ({
  scheme,
  keywordObject = {}
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)

  if (isLookupFullPathScheme(normalizedScheme)) {
    const fullPath = getFullPathLookupValueFromKeywordObject({
      scheme: normalizedScheme,
      keywordObject
    })

    if (!fullPath) {
      return undefined
    }

    const cacheKey = createPublishedConceptResponseCacheKeyByFullPath({
      fullPath: fullPath.toLowerCase(),
      scheme: normalizedScheme
    })
    const cachedResponse = await getCachedJsonResponse({
      cacheKey,
      entityLabel: 'Published Concept by fullPath'
    })

    return parseCachedConceptResponse({
      cachedResponse,
      scheme: normalizedScheme
    })
  }

  if (isLookupShortNameScheme(normalizedScheme)) {
    const shortName = getShortNameLookupValueFromKeywordObject(keywordObject)

    if (!shortName) {
      return undefined
    }

    const cacheKey = createPublishedConceptResponseCacheKeyByShortName({
      shortName: shortName.toLowerCase(),
      scheme: normalizedScheme
    })
    const cachedResponse = await getCachedJsonResponse({
      cacheKey,
      entityLabel: 'Published Concept by shortName'
    })

    return parseCachedConceptResponse({
      cachedResponse,
      scheme: normalizedScheme
    })
  }

  return undefined
}

export default {
  buildKeywordPathFromKeywordObject,
  buildKeywordObjectFromPath,
  ensureCorrectionKeywordObjects,
  getHistoricalConceptByFullPath,
  getHistoricalConceptByShortName,
  getHistoricalConceptByKeyword,
  getPublishedConceptByKeyword,
  getPublishedConceptByUuid
}
