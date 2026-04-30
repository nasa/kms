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
 * This helper only extracts the scheme-specific value shape. Later steps decide whether that
 * value should be flattened into a full-path lookup, a short-name lookup, or another placeholder.
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
