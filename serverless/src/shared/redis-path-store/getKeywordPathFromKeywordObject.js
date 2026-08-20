import { buildKeywordPathFromObject } from './helpers/buildKeywordPathFromObject'
import { CSV_FIELDS } from './helpers/constants'
import { normalizeKeywordScheme } from './helpers/normalizeKeywordScheme'
import { splitKeywordPath } from './helpers/splitKeywordPath'
import { trimKeywordPathSegment } from './helpers/trimKeywordPathSegment'

/**
 * Converts a normalized keyword object into the human-readable path string used by KMS lookups.
 *
 * Configured schemes use their normalized CSV fields in column order. Unknown schemes do not
 * produce a keyword path.
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

  if (!Array.isArray(CSV_FIELDS[normalizedScheme])) {
    return undefined
  }

  const keywordPath = buildKeywordPathFromObject({
    scheme: normalizedScheme,
    keywordObject
  })

  return splitKeywordPath(keywordPath)
    .some((segment) => trimKeywordPathSegment(segment).length > 0)
    ? keywordPath
    : undefined
}
