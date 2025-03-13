/**
 * Keyword Scheme Sorting Module
 *
 * This module provides functionality to sort keyword schemes based on a predefined sequence.
 */

/**
 * @constant {string[]} keywordSchemeSequence
 * An array that defines the preferred order of keyword schemes.
 * Schemes not in this list will be sorted alphabetically after the predefined schemes.
 */
export const keywordSchemeSequence = [
  'Earth Science',
  'Earth Science Services',
  'Platforms',
  'Instruments',
  'Providers',
  'Projects',
  'Locations',
  'Horizontal Resolution Ranges',
  'Vertical Resolution Ranges',
  'Temporal Resolution Ranges',
  'Related URL Content Types',
  'Data Format',
  'Measurement Name',
  'Chronostratigraphic Units'
]

/**
 * Sorts keyword schemes based on the predefined sequence or alphabetically.
 *
 * @param {Object} schemeA - The first keyword scheme object to compare.
 * @param {Object} schemeB - The second keyword scheme object to compare.
 * @param {string} schemeA.title - The title of the first keyword scheme.
 * @param {string} schemeB.title - The title of the second keyword scheme.
 * @returns {number} A negative number if 'schemeA' should come before 'schemeB',
 *                   a positive number if 'schemeB' should come before 'schemeA',
 *                   or 0 if they are equivalent.
 *
 * @example
 * // Sorting schemes in the predefined sequence
 * const schemes = [
 *   { title: 'Platforms' },
 *   { title: 'Earth Science' },
 *   { title: 'Instruments' }
 * ];
 * schemes.sort(sortKeywordSchemes);
 * // Result: [
 * //   { title: 'Earth Science' },
 * //   { title: 'Platforms' },
 * //   { title: 'Instruments' }
 * // ]
 *
 * @example
 * // Sorting schemes not in the predefined sequence
 * const schemes = [
 *   { title: 'Custom Scheme B' },
 *   { title: 'Custom Scheme A' },
 *   { title: 'Earth Science' }
 * ];
 * schemes.sort(sortKeywordSchemes);
 * // Result: [
 * //   { title: 'Earth Science' },
 * //   { title: 'Custom Scheme A' },
 * //   { title: 'Custom Scheme B' }
 * // ]
 */
export const sortKeywordSchemes = (schemeA, schemeB) => {
  // Check if schemeA and schemeB are valid objects with a title property
  const titleA = schemeA && schemeA.title ? schemeA.title : ''
  const titleB = schemeB && schemeB.title ? schemeB.title : ''

  const indexA = keywordSchemeSequence.indexOf(titleA)
  const indexB = keywordSchemeSequence.indexOf(titleB)

  if (indexA === -1 && indexB === -1) {
    return titleA.localeCompare(titleB)
  }

  if (indexA === -1) return 1
  if (indexB === -1) return -1

  return indexA - indexB
}
