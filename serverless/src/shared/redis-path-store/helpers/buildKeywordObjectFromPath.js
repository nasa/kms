import { buildKeywordPathObjectFromSegments } from './buildKeywordPathObjectFromSegments'
import { FULL_PATH_VALUE_FIELDS, SHORT_NAME_OBJECT_FIELDS } from './constants'
import { isLookupShortNameScheme } from './isLookupShortNameScheme'
import { joinKeywordPath } from './joinKeywordPath'
import { normalizeKeywordScheme } from './normalizeKeywordScheme'
import { splitKeywordPath } from './splitKeywordPath'
import { trimKeywordPathSegment } from './trimKeywordPathSegment'

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
}) => buildKeywordPathObjectFromSegments({
  scheme,
  segments: splitKeywordPath(keywordPath)
})

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

const buildShortNameKeywordObjectFromSegments = ({
  scheme,
  segments
}) => {
  const normalizedScheme = normalizeKeywordScheme(scheme)
  const fieldNames = SHORT_NAME_OBJECT_FIELDS[normalizedScheme]
  const normalizedSegments = segments.map(
    (segment) => trimKeywordPathSegment(segment)
  )

  if (fieldNames.length === 1) {
    const singleValue = normalizedScheme === 'idnnode'
      ? joinKeywordPath(normalizedSegments)
      : [...normalizedSegments].reverse().find((segment) => segment.length > 0) || ''

    return {
      [fieldNames[0]]: singleValue
    }
  }

  const lastNonEmptyIndex = normalizedSegments.reduce((lastIndex, segment, index) => (
    segment.length > 0 ? index : lastIndex
  ), -1)
  const shortName = lastNonEmptyIndex >= 0 ? normalizedSegments[lastNonEmptyIndex] : ''
  const hierarchySegments = lastNonEmptyIndex >= 0
    ? normalizedSegments.slice(0, lastNonEmptyIndex)
    : normalizedSegments.slice()

  if (normalizedScheme === 'platforms') {
    const hasCategoryPrefix = normalizeKeywordScheme(hierarchySegments[0]) === 'platforms'

    return {
      Category: hasCategoryPrefix ? hierarchySegments[0] : '',
      Class: hasCategoryPrefix ? hierarchySegments[1] || '' : hierarchySegments[0] || '',
      Type: hasCategoryPrefix ? hierarchySegments[2] || '' : hierarchySegments[1] || '',
      ShortName: shortName
    }
  }

  if (normalizedScheme === 'instruments') {
    return {
      Category: hierarchySegments[0] || '',
      Class: hierarchySegments[1] || '',
      Subclass: hierarchySegments[2] || '',
      ShortName: shortName
    }
  }

  if (normalizedScheme === 'projects') {
    return {
      Category: hierarchySegments[0] || '',
      ShortName: shortName
    }
  }

  return {
    BucketLevel0: hierarchySegments[0] || '',
    BucketLevel1: hierarchySegments[1] || '',
    BucketLevel2: hierarchySegments[2] || '',
    BucketLevel3: hierarchySegments[3] || '',
    ShortName: shortName
  }
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

  const slotFields = FULL_PATH_VALUE_FIELDS[normalizedScheme]

  if (Array.isArray(slotFields)) {
    return buildKeywordPathObjectFromPath({
      scheme: normalizedScheme,
      keywordPath: joinKeywordPath(stripLeadingSchemeLabel({
        normalizedScheme,
        pathSegments: splitKeywordPath(normalizedKeywordPath)
      }))
    })
  }

  if (isLookupShortNameScheme(normalizedScheme)) {
    return buildShortNameKeywordObjectFromSegments({
      scheme: normalizedScheme,
      segments: splitKeywordPath(normalizedKeywordPath)
    })
  }

  return {
    Value: normalizedKeywordPath
  }
}
