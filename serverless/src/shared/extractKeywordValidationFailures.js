import { extractKeywordValue } from './extractKeywordValue'
import { logger } from './logger'

/*
 * Extraction mapping reference
 *
 * This file does two things for each supported scheme:
 * 1. map a CMR validation path to a KMS scheme
 * 2. pull the current broken keyword value back out of UMM-C
 *
 * Current scheme behavior:
 * - sciencekeywords: read the ScienceKeywords object and carry a pipe-delimited full path.
 * - locations: read the LocationKeywords object and carry a pipe-delimited full path.
 * - chronounits: read the chronostratigraphic object, map Stage -> Age and
 *   DetailedClassification -> SubAge, then carry a pipe-delimited full path.
 * - rucontenttype: read URLContentType, Type, and Subtype and carry a pipe-delimited path.
 * - isotopiccategory: read the ISO topic category string directly.
 * - temporalresolutionrange: read the raw TemporalResolution value from UMM-C.
 * - horizontalresolutionrange: read the HorizontalDataResolution object and flatten it.
 * - verticalresolutionrange: read the VerticalSpatialDomains object and flatten it.
 * - ProductLevelId: read ProcessingLevel.Id directly.
 * - providers, platforms, instruments, projects, idnnode: read the richer UMM-C object,
 *   but intentionally collapse the lookup input down to ShortName.
 * - DataFormat and GranuleDataFormat: read the format string directly and treat it like
 *   a short-name lookup input.
 *
 * The shared `extractKeywordValue` helper owns the scheme-specific UMM-C extraction logic.
 */
/**
 * Checks whether a validation path contains an exact segment name.
 *
 * @param {Array<string|number>} path CMR validation path segments.
 * @param {string} segment Exact segment to search for.
 * @returns {boolean} `true` when the path contains the segment.
 */
const pathIncludes = (path, segment) => path.includes(segment)

/**
 * Checks whether a validation path contains a string segment with the given prefix.
 *
 * @param {Array<string|number>} path CMR validation path segments.
 * @param {string} prefix Prefix to search for.
 * @returns {boolean} `true` when any string path segment starts with the prefix.
 */
const pathIncludesPrefix = (path, prefix) => path.some(
  (segment) => typeof segment === 'string' && segment.startsWith(prefix)
)

/**
 * Maps a CMR validation path back to the KMS keyword scheme it belongs to.
 *
 * @param {Array<string|number>} path CMR validation path segments.
 * @returns {string|null} Matching KMS scheme, or `null` when the path is not keyword-related.
 */
const getKeywordSchemeForPath = (path) => {
  const [rootField] = path

  switch (rootField) {
    case 'ScienceKeywords':
      return 'sciencekeywords'
    case 'Platforms':
      return path.includes('Instruments') ? 'instruments' : 'platforms'
    case 'Projects':
      return 'projects'
    case 'LocationKeywords':
      return 'locations'
    case 'PaleoTemporalCoverages':
      return pathIncludes(path, 'ChronostratigraphicUnits') ? 'chronounits' : null
    case 'DataCenters':
      return 'providers'
    case 'DirectoryNames':
      return 'idnnode'
    case 'ISOTopicCategories':
    case 'IsoTopicCategories':
      return 'isotopiccategory'
    case 'TemporalExtents':
      return pathIncludes(path, 'TemporalResolution') ? 'temporalresolutionrange' : null
    case 'SpatialInformation':
      if (pathIncludesPrefix(path, 'HorizontalDataResolution')) {
        return 'horizontalresolutionrange'
      }

      return pathIncludes(path, 'VerticalCoordinateSystem') ? 'verticalresolutionrange' : null
    case 'SpatialExtent':
      return pathIncludes(path, 'VerticalSpatialDomains') ? 'verticalresolutionrange' : null
    case 'ProcessingLevel':
      return 'ProductLevelId'
    case 'ArchiveAndDistributionInformation':
      return path.includes('FileArchiveInformation') || path.includes('FileDistributionInformation')
        ? 'DataFormat'
        : null
    case 'RelatedUrls':
      return path.includes('GetData') && path.includes('Format')
        ? 'GranuleDataFormat'
        : 'rucontenttype'
    default:
      return null
  }
}

/**
 * Flattens nested UMM keyword values into a simple string array for serialization.
 *
 * @param {unknown} keywordValue Extracted keyword value from UMM.
 * @returns {string[]} Flattened scalar values.
 */
const flattenKeywordValues = (keywordValue) => {
  if (keywordValue === undefined || keywordValue === null) {
    return []
  }

  if (Array.isArray(keywordValue)) {
    return keywordValue.flatMap(flattenKeywordValues)
  }

  if (typeof keywordValue === 'object') {
    return Object.values(keywordValue).flatMap(flattenKeywordValues)
  }

  return [String(keywordValue)]
}

/**
 * Determines whether an extracted keyword value contains at least one usable lookup token.
 *
 * @param {unknown} keywordValue Extracted keyword value from UMM.
 * @returns {boolean} `true` when the value can be serialized for later lookup/debugging.
 */
const hasMeaningfulKeywordValue = (keywordValue) => flattenKeywordValues(keywordValue).length > 0

/**
 * Chooses the serialized lookup components appropriate for the resolved scheme.
 *
 * Some schemes intentionally collapse richer UMM-C objects down to short-name lookup input.
 *
 * @param {object} params Serialization inputs.
 * @param {string} params.scheme KMS keyword scheme.
 * @param {unknown} params.keywordValue Extracted keyword value from UMM.
 * @returns {string[]} Ordered lookup tokens for logging/resolution.
 */
const getSerializedValuesForScheme = ({
  scheme,
  keywordValue
}) => {
  switch (scheme) {
    case 'platforms':
    case 'instruments':
    case 'projects':
    case 'providers':
    case 'idnnode':
      return keywordValue?.ShortName ? [keywordValue.ShortName] : flattenKeywordValues(keywordValue)
    default:
      return flattenKeywordValues(keywordValue)
  }
}

/**
 * Builds the compact serialized `oldKeyword` value surfaced in correction responses.
 *
 * @param {object} params Serialization inputs.
 * @param {string} params.scheme KMS keyword scheme.
 * @param {unknown} params.keywordValue Extracted keyword value from UMM.
 * @returns {string|undefined} Serialized keyword string, or `undefined` when no usable value exists.
 */
const buildOldKeywordValue = ({
  scheme,
  keywordValue
}) => {
  if (!hasMeaningfulKeywordValue(keywordValue)) {
    return undefined
  }

  const serializedKeywordValue = getSerializedValuesForScheme({
    scheme,
    keywordValue
  }).join('|')

  return serializedKeywordValue
}

/**
 * Normalizes keyword-related CMR validation failures into a later-ticket-friendly shape.
 *
 * KMS-675 stops at extracting the current broken keyword value from UMM-C. Follow-on work
 * will resolve replacements and delegate the actual native metadata update using this shape.
 *
 * @param {object} params - Extraction parameters.
 * @param {Record<string, unknown>} params.umm - The collection UMM-C payload.
 * @param {Array<{ path?: Array<string|number>, errors?: string[] }>} params.validationErrors - Raw CMR validation errors.
 * @returns {Array<{
 *   scheme: string,
 *   path: Array<string|number>,
 *   errors: string[],
 *   oldKeyword?: string,
 *   keywordValue: unknown
 * }>} Supported keyword validation failures with extracted values.
 */
export const extractKeywordValidationFailures = ({
  umm,
  validationErrors = []
}) => {
  const keywordFailures = validationErrors.reduce((accumulator, validationError) => {
    const {
      path = [],
      errors = []
    } = validationError || {}
    const scheme = getKeywordSchemeForPath(path)

    if (!scheme) {
      return accumulator
    }

    const keywordValue = extractKeywordValue({
      scheme,
      path,
      umm
    })
    const oldKeyword = buildOldKeywordValue({
      scheme,
      keywordValue
    })

    accumulator.push({
      scheme,
      path,
      errors,
      oldKeyword,
      keywordValue
    })

    return accumulator
  }, [])

  logger.debug(
    '[metadata-correction] Extracted keyword validation failures from UMM-C '
    + `validationErrorCount=${validationErrors.length} `
    + `keywordFailureCount=${keywordFailures.length}`
  )

  return keywordFailures
}

export default extractKeywordValidationFailures
