/**
 * Checks whether a keyword object contains at least one non-blank value for logging.
 *
 * @param {Record<string, unknown>|null|undefined} keywordObject - Candidate keyword object.
 * @returns {boolean} True when the object contains a meaningful value.
 */
export const hasMeaningfulKeywordObject = (keywordObject) => (
  keywordObject
  && typeof keywordObject === 'object'
  && Object.entries(keywordObject).some(([, value]) => {
    if (Array.isArray(value)) {
      return value.some((segment) => String(segment || '').trim().length > 0)
    }

    return String(value || '').trim().length > 0
  })
)

export default hasMeaningfulKeywordObject
