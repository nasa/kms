/**
 * Parses a keyword path string into an array of segments.
 *
 * Split the input string by the ' > ' delimiter and trims whitespace from
 * each resulting segment. This function preserves empty segments to maintain
 * structural integrity
 * @param {string} [keywordPath = ''] - the path string to process.
 * @returns {string[]} An array of trimmed path segments.
 *
 * @example
 * // Returns ["A", "B", "C"]
 * splitKeywordPath("A > B > C")
 *
 * @example
 * // Returns ["A", "", "C"]
 * splitKeywordPath("A >  > C")
 *
 * @example
 * // Returns [""]
 * splitKeywordPath("")
 *
 */
export const splitKeywordPath = (keywordPath = '') => keywordPath
  .split(' > ')
  .map((segment) => segment.trim())
