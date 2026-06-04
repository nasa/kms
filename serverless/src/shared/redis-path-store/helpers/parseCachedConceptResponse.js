import { buildKeywordObjectFromPath } from './buildKeywordObjectFromPath'

const attachSupplementalKeywordFields = ({
  concept,
  keywordObject
}) => {
  const nextKeywordObject = { ...keywordObject }

  if (concept.longName && !nextKeywordObject.LongName) {
    nextKeywordObject.LongName = concept.longName
  }

  if (concept.providerUrl && !nextKeywordObject.DataCenterUrl) {
    nextKeywordObject.DataCenterUrl = concept.providerUrl
  }

  return nextKeywordObject
}

const attachKeywordObjectToConcept = ({
  concept,
  scheme
}) => {
  if (!concept) {
    return undefined
  }

  const baseKeywordObject = concept.fullPath
    ? buildKeywordObjectFromPath({
      scheme,
      keywordPath: concept.fullPath
    })
    : {}

  if (concept.keywordObject && typeof concept.keywordObject === 'object') {
    return {
      ...concept,
      keywordObject: attachSupplementalKeywordFields({
        concept,
        keywordObject: {
          ...baseKeywordObject,
          ...concept.keywordObject
        }
      })
    }
  }

  return {
    ...concept,
    keywordObject: attachSupplementalKeywordFields({
      concept,
      keywordObject: baseKeywordObject
    })
  }
}

/**
 * Parses a cached concept response body and reattaches the normalized keyword object.
 *
 * @param {Object} params The cached response parse input.
 * @param {{body?: string}|undefined} params.cachedResponse Cached HTTP-like response object.
 * @param {string} params.scheme Keyword scheme name.
 * @returns {Object|undefined} Parsed concept with a normalized `keywordObject`, or `undefined`
 *   when the cached response does not contain a body.
 */
export const parseCachedConceptResponse = ({
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
