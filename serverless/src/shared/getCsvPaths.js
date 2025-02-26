// Import necessary utility functions
import { buildHierarchicalCsvPaths } from '@/shared/buildHierarchicalCsvPaths'
import { getLongNamesMap } from '@/shared/getLongNamesMap'
import { getNarrowersMap } from '@/shared/getNarrowersMap'
import { getProviderUrlsMap } from '@/shared/getProviderUrlsMap'
import { getRootConcept } from '@/shared/getRootConcept'

/**
 * Function to get CSV paths for a given scheme
 * @param {string} scheme - The scheme to get CSV paths for
 * @param {number} csvHeadersCount - The number of CSV headers
 * @returns {Promise<Array>} - A promise that resolves to an array of CSV paths
 */
export const getCsvPaths = async (scheme, csvHeadersCount) => {
  // Get the root concept for the scheme
  const root = await getRootConcept(scheme)

  // Create a node object with root concept information
  const node = {
    prefLabel: root?.prefLabel?.value,
    narrowerPrefLabel: root?.prefLabel?.value,
    uri: root?.subject?.value
  }

  // Get maps for narrowers and long names
  const narrowersMap = await getNarrowersMap(scheme)
  const longNamesMap = await getLongNamesMap(scheme)

  // Initialize providerUrlsMap
  let providerUrlsMap = []
  // If the scheme is 'providers', get the provider URLs map
  if (scheme === 'providers') {
    providerUrlsMap = await getProviderUrlsMap(scheme)
  }

  // Initialize an array to store keywords
  const keywords = []

  // Traverse the graph to populate keywords
  await buildHierarchicalCsvPaths(
    csvHeadersCount,
    providerUrlsMap,
    longNamesMap,
    scheme,
    node,
    narrowersMap,
    [],
    keywords
  )

  // Return the reversed keywords array
  return keywords.reverse()
}
