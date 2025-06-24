// Import necessary utility functions
import { buildHierarchicalCsvPaths } from '@/shared/buildHierarchicalCsvPaths'
import { getLongNamesMap } from '@/shared/getLongNamesMap'
import { getNarrowersMap } from '@/shared/getNarrowersMap'
import { getProviderUrlsMap } from '@/shared/getProviderUrlsMap'
import { getRootConceptForScheme } from '@/shared/getRootConceptForScheme'

/**
 * Function to get CSV paths for a given scheme and version
 * @async
 * @function getCsvPaths
 * @param {string} scheme - The scheme to get CSV paths for
 * @param {number} csvHeadersCount - The number of CSV headers
 * @param {string} version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number)
 * @returns {Promise<Array>} - A promise that resolves to an array of CSV paths
 *
 * @example
 * // Get CSV paths for 'providers' scheme with 3 CSV headers in the published version
 * try {
 *   const providerPaths = await getCsvPaths('providers', 3, 'published');
 *   console.log(providerPaths);
 *   // Output: [
 *   //   ['Root', 'Child1', 'Grandchild1'],
 *   //   ['Root', 'Child1', 'Grandchild2'],
 *   //   ['Root', 'Child2', 'Grandchild3']
 *   // ]
 * } catch (error) {
 *   console.error('Error getting CSV paths:', error);
 * }
 *
 * @example
 * // Get CSV paths for 'subjects' scheme with 2 CSV headers in the draft version
 * try {
 *   const subjectPaths = await getCsvPaths('subjects', 2, 'draft');
 *   console.log(subjectPaths);
 *   // Output: [
 *   //   ['Root', 'Subject1'],
 *   //   ['Root', 'Subject2'],
 *   //   ['Root', 'Subject3']
 *   // ]
 * } catch (error) {
 *   console.error('Error getting CSV paths:', error);
 * }
 *
 * @throws {Error} If there's an error retrieving the root concept, narrowers map, long names map, or provider URLs map
 *
 * @see Related functions:
 * {@link getRootConceptForScheme}
 * {@link getNarrowersMap}
 * {@link getLongNamesMap}
 * {@link getProviderUrlsMap}
 * {@link buildHierarchicalCsvPaths}
 */
export const getCsvPaths = async (scheme, csvHeadersCount, version) => {
  const keywords = []
  const roots = await getRootConceptForScheme(scheme, version)

  console.log('roots=', roots)

  const narrowersMap = await getNarrowersMap(scheme, version)
  const longNamesMap = await getLongNamesMap(scheme, version)

  let providerUrlsMap = []
  if (scheme === 'providers') {
    providerUrlsMap = await getProviderUrlsMap(scheme, version)
  }

  await Promise.all(roots.map(async (root) => {
    const node = {
      prefLabel: root?.prefLabel?.value,
      narrowerPrefLabel: root?.prefLabel?.value,
      uri: root?.subject?.value
    }

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
  }))

  return keywords.reverse()
}
