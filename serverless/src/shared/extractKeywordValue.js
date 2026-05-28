/**
 * UMM-C keyword value extraction helper for the metadata-correction pipeline.
 *
 * This module is the bridge between a validation error path and the actual keyword value living
 * inside a collection's UMM-C payload. Once validation tells us "the broken keyword is at this
 * path", this helper walks that path back into UMM-C and returns the scheme-specific value shape
 * that later steps use for lookup and resolution.
 *
 * It exists because the metadata-correction flow needs something more precise than a generic
 * "get object at path" helper:
 * - some schemes are stored as nested full-path fragments in UMM-C
 * - some are stored as short-name objects
 * - some need field normalization before they can be matched against KMS lookups
 *
 * This helper only supports the subset of UMM-C keyword families that KMS-675 currently validates
 * and corrects. Today that includes:
 * - science keywords
 * - platforms and instruments
 * - projects
 * - locations
 * - chrono units
 * - providers
 * - idn nodes
 * - ISO topic categories
 * - temporal / horizontal / vertical resolution ranges
 * - product level id
 * - data format and granule data format
 * - related URL content type
 *
 * Anything outside that supported set is intentionally out of scope for this helper until the
 * metadata-correction pipeline adds validation and resolution rules for it.
 */
// CMR returns `IsoTopicCategories`, but UMM-C stores `ISOTopicCategories`.
const normalizeValidationPath = (path = []) => {
  const [rootField, ...rest] = path

  if (rootField === 'IsoTopicCategories') {
    return ['ISOTopicCategories', ...rest]
  }

  return path
}

// Walk each CMR validation path segment through nested UMM-C objects/arrays to reach the
// broken value. Examples:
// - ['ScienceKeywords', 0] -> umm.ScienceKeywords[0]
// - ['Platforms', 0, 'Instruments', 0] -> umm.Platforms[0].Instruments[0]
// - ['ProcessingLevel', 'Id'] -> umm.ProcessingLevel.Id
// If any step is missing, optional chaining returns undefined instead of throwing.
const getValueAtPath = (source, path) => path.reduce(
  (currentValue, segment) => currentValue?.[segment],
  source
)

/**
 * Pulls the current broken keyword value out of UMM-C for a supported KMS scheme.
 *
 * The input path usually comes from keyword validation output. We first normalize any known
 * path-name mismatches between validation and UMM-C, walk to the target value, and then reshape
 * that value when a scheme needs a more KMS-friendly representation.
 *
 * Examples:
 * - `chronounits` remaps UMM-C fields like `Stage` -> `Age`
 * - `rucontenttype` extracts only `URLContentType`, `Type`, and `Subtype`
 * - `DataFormat` and `GranuleDataFormat` collapse to the format string
 *
 * This helper deliberately stops at extraction. Later steps decide whether the extracted value
 * should be interpreted as a full-path lookup, a short-name lookup, or a placeholder used during
 * historical keyword resolution.
 *
 * @param {object} params - Extraction parameters.
 * @param {string} params.scheme - Supported KMS scheme.
 * @param {Array<string|number>} params.path - Raw CMR validation path.
 * @param {Record<string, unknown>} params.umm - Collection UMM-C payload.
 * @returns {unknown} Scheme-specific keyword value pulled from UMM-C.
 */
export const extractKeywordValue = ({
  scheme,
  path,
  umm
}) => {
  const rawValue = getValueAtPath(umm, normalizeValidationPath(path))

  switch (scheme) {
    case 'chronounits':
      return {
        Eon: rawValue?.Eon,
        Era: rawValue?.Era,
        Period: rawValue?.Period,
        Epoch: rawValue?.Epoch,
        Age: rawValue?.Stage,
        SubAge: rawValue?.DetailedClassification
      }
    case 'rucontenttype':
      return {
        URLContentType: rawValue?.URLContentType,
        Type: rawValue?.Type,
        Subtype: rawValue?.Subtype
      }
    case 'ProductLevelId':
      return rawValue?.Id || rawValue
    case 'DataFormat':
    case 'GranuleDataFormat':
      return rawValue?.Format || rawValue
    default:
      return rawValue
  }
}

export default extractKeywordValue
