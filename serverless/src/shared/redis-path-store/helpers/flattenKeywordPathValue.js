import { trimKeywordPathSegment } from './trimKeywordPathSegment'

/**
 * Flattens nested keyword values into an ordered list of scalar path segments.
 *
 * @param {any} keywordValue Raw keyword value, typically a scalar, array, or object.
 * @returns {string[]} Flattened and trimmed path segments.
 */
export const flattenKeywordPathValue = (keywordValue) => {
  if (keywordValue === undefined || keywordValue === null) {
    return []
  }

  if (Array.isArray(keywordValue)) {
    return keywordValue.flatMap(flattenKeywordPathValue)
  }

  if (typeof keywordValue === 'object') {
    return Object.values(keywordValue).flatMap(flattenKeywordPathValue)
  }

  return [trimKeywordPathSegment(keywordValue)]
}
