/**
 * Normalize optional text inputs so object comparisons and XML writes behave consistently.
 */
export const trimString = (value) => ((typeof value === 'string') ? value.trim() : '')

/**
 * Regex for validating if a string is a simple absolute XML field path (e.g., //Path/To/Node).
 */
export const SIMPLE_ABSOLUTE_FIELD_PATH = /^\/\/[A-Za-z_][\w.-]*(\/[A-Za-z_][\w.-]*)*$/

/**
 * Validates if the provided string is a valid simple absolute XML field path.
 * * @param {string} path - The path string to validate.
 * @returns {boolean} True if the path matches the expected pattern.
 */
export const isSimpleFieldPath = (path) => SIMPLE_ABSOLUTE_FIELD_PATH.test(path)

/**
 * Resolves the most useful scalar representation of a keyword object for leaf/scalar updates.
 * This is now the single source of truth for both ISO 19115 and generic XML editors.
 *
 * @example
 * getScalarKeywordText({ Value: 'OCEANS', ShortName: 'ignored' })
 * // 'OCEANS'
 */
export const getScalarKeywordText = (keywordObject = {}) => {
  // 1. Define preference list (Value, then ShortName)
  const preferredValue = [keywordObject.Value, keywordObject.ShortName]
    .map((value) => trimString(value))
    .find((value) => value.length > 0)

  // 2. Return if found
  if (preferredValue) {
    return preferredValue
  }

  // 3. Fallback: return the first non-empty value in the object
  return Object.values(keywordObject)
    .map((value) => trimString(value))
    .find((value) => value.length > 0) || ''
}

/**
 * Trims a keyword-style object down to the specific keys being compared so find/replace matching
 * stays consistent even when callers provide extra fields or untrimmed values.
 *
 * @param {Record<string, any>|null|undefined} valueObject Candidate keyword-style object.
 * @param {string[]} valueKeys Ordered keys that matter for the current comparison.
 * @returns {Record<string, string>} Trimmed object containing only the requested keys.
 *
 * @example
 * normalizeValueObject({ Type: ' GET DATA ', Subtype: ' GIOVANNI ' }, ['Type', 'Subtype'])
 * // { Type: 'GET DATA', Subtype: 'GIOVANNI' }
 */
export const normalizeValueObject = (valueObject, valueKeys) => valueKeys.reduce(
  (normalizedObject, valueKey) => ({
    ...normalizedObject,
    [valueKey]: trimString(valueObject?.[valueKey])
  }),
  {}
)

/**
 * Extracts namespace declarations (xmlns:prefix) from a given XML root element.
 * * @param {Element} rootElement - The DOM root element.
 * @returns {Object} A map where keys are prefixes and values are namespace URIs.
 */
export const extractNamespaces = (rootElement) => {
  const namespaces = {}
  for (let i = 0; i < rootElement.attributes.length; i += 1) {
    const attr = rootElement.attributes[i]
    if (attr.name.startsWith('xmlns:')) {
      const prefix = attr.name.replace('xmlns:', '')
      namespaces[prefix] = attr.value
    }
  }

  return namespaces
}
