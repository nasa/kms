import { buildFullPathLookupValue } from './helpers/buildFullPathLookupValue'
import { buildKeywordPathFromObject } from './helpers/buildKeywordPathFromObject'
import { isLookupFullPathScheme } from './helpers/isLookupFullPathScheme'
import { isLookupShortNameScheme } from './helpers/isLookupShortNameScheme'
import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'
import { splitKeywordPath } from './helpers/splitKeywordPath'
import { trimKeywordPathSegment } from './helpers/trimKeywordPathSegment'

/**
 * Converts a normalized keyword object into the human-readable path string used by KMS lookups.
 *
 * Full-path schemes return `Category > Topic > ...` style paths, short-name schemes return their
 * hierarchical short-name path, and scalar schemes return the trimmed `Value` field.
 *
 * @param {object} params - Keyword path inputs.
 * @param {string} params.scheme - KMS keyword scheme.
 * @param {Record<string, string>} params.keywordObject - Normalized keyword object.
 * @returns {string|undefined} Resolved keyword path string, or `undefined` when the object has no
 * meaningful path value.
 *
 * @example
 * // Request
 * const keywordPath = getKeywordPathFromKeywordObject({
 *   scheme: 'sciencekeywords',
 *   keywordObject: {
 *     Category: 'EARTH SCIENCE',
 *     Topic: 'ATMOSPHERE',
 *     Term: 'AEROSOLS'
 *   }
 * })
 *
 * // Response
 * // 'EARTH SCIENCE > ATMOSPHERE > AEROSOLS'
 */
export const getKeywordPathFromKeywordObject = ({
  scheme,
  keywordObject
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)

  if (!keywordObject || typeof keywordObject !== 'object') {
    return undefined
  }

  if (isLookupFullPathScheme(normalizedScheme)) {
    return buildFullPathLookupValue({
      scheme: normalizedScheme,
      keywordValue: keywordObject
    })
  }

  if (isLookupShortNameScheme(normalizedScheme)) {
    const keywordPath = buildKeywordPathFromObject({
      scheme: normalizedScheme,
      keywordObject
    })

    return splitKeywordPath(keywordPath)
      .some((segment) => trimKeywordPathSegment(segment).length > 0)
      ? keywordPath
      : undefined
  }

  const scalarValue = trimKeywordPathSegment(keywordObject.Value)

  return scalarValue.length > 0 ? scalarValue : undefined
}
