// Import necessary utility functions
import { buildHierarchicalCsvPaths } from '@/shared/buildHierarchicalCsvPaths'
import { getLongNamesMap } from '@/shared/getLongNamesMap'
import { getNarrowersMap } from '@/shared/getNarrowersMap'
import { getProviderUrlsMap } from '@/shared/getProviderUrlsMap'
import { getRootConceptForScheme } from '@/shared/getRootConceptForScheme'

/**
 * Function to get CSV paths for a given scheme
 * @param {string} scheme - The scheme to get CSV paths for
 * @param {number} csvHeadersCount - The number of CSV headers
 * @returns {Promise<Array>} - A promise that resolves to an array of CSV paths
 *
 * @example
 * // Get CSV paths for 'providers' scheme with 3 CSV headers
 * const providerPaths = await getCsvPaths('providers', 3);
 * console.log(providerPaths);
 * // Output: [
 * //   ['Root', 'Child1', 'Grandchild1'],
 * //   ['Root', 'Child1', 'Grandchild2'],
 * //   ['Root', 'Child2', 'Grandchild3']
 * // ]
 *
 * @example
 * // Get CSV paths for 'subjects' scheme with 2 CSV headers
 * const subjectPaths = await getCsvPaths('subjects', 2);
 * console.log(subjectPaths);
 * // Output: [
 * //   ['Root', 'Subject1'],
 * //   ['Root', 'Subject2'],
 * //   ['Root', 'Subject3']
 * // ]
 */
export const getCsvPaths = async (scheme, csvHeadersCount, version) => {
  // Get the root concept for the scheme
  const root = await getRootConceptForScheme(scheme, version)

  // Create a node object with root concept information
  const node = {
    prefLabel: root?.prefLabel?.value,
    narrowerPrefLabel: root?.prefLabel?.value,
    uri: root?.subject?.value
  }

  // Get maps for narrowers and long names
  const narrowersMap = await getNarrowersMap(scheme, version)
  const longNamesMap = await getLongNamesMap(scheme, version)

  // Initialize providerUrlsMap
  let providerUrlsMap = []
  // If the scheme is 'providers', get the provider URLs map
  if (scheme === 'providers') {
    providerUrlsMap = await getProviderUrlsMap(scheme, version)
  }

  // Initialize an array to store keywords
  const keywords = []

  // Traverse the graph to populate keywords
  await buildHierarchicalCsvPaths({
    csvHeadersCount,
    providerUrlsMap,
    longNamesMap,
    scheme,
    n: node,
    map: narrowersMap,
    path: [],
    paths: keywords
  })

  // Return the reversed keywords array
  return keywords.reverse()
}
