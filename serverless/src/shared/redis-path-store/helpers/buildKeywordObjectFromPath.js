import { CSV_FIELDS } from './constants'
import { isLookupShortNameScheme } from './isLookupShortNameScheme'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'
import { splitKeywordPath } from './splitKeywordPath'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

const stripLeadingSchemeLabel = ({
  normalizedScheme,
  pathSegments
}) => {
  const firstSegment = trimKeywordPathSegment(pathSegments[0]).toLowerCase()

  if (
    normalizedScheme === 'sciencekeywords'
    && (
      firstSegment === normalizedScheme
      || firstSegment === 'science keywords'
    )
  ) {
    return pathSegments.slice(1)
  }

  return pathSegments
}

/**
 * Builds a slotted keyword-path object from a canonical keyword path string.
 *
 * @param {Object} params The keyword-path parsing input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {string} params.keywordPath Canonical ` > `-delimited keyword path.
 * @returns {Object} Slotted keyword-path object for schemes that use fixed path fields.
 */
export const buildKeywordPathObjectFromPath = ({
  scheme,
  keywordPath
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const fields = CSV_FIELDS[normalizedScheme]

  if (!Array.isArray(fields)) {
    return {}
  }

  let segments = stripLeadingSchemeLabel({
    normalizedScheme,
    pathSegments: splitKeywordPath(keywordPath)
  })

  if (isLookupShortNameScheme(normalizedScheme) && segments.length < fields.length) {
    segments = [
      ...Array(fields.length - segments.length).fill(''),
      ...segments
    ]
  }

  return Object.fromEntries(fields.map((field, index) => [
    field,
    trimKeywordPathSegment(segments[index])
  ]))
}

/**
 * Builds a normalized keyword object from a canonical keyword path string.
 *
 * @param {Object} params The keyword-path parsing input.
 * @param {string} params.scheme Keyword scheme name.
 * @param {string} params.keywordPath Canonical ` > `-delimited keyword path.
 * @returns {Object} Normalized keyword object for the scheme.
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

  if (Array.isArray(CSV_FIELDS[normalizedScheme])) {
    return buildKeywordPathObjectFromPath({
      scheme: normalizedScheme,
      keywordPath: normalizedKeywordPath
    })
  }

  return {
    Value: normalizedKeywordPath
  }
}
