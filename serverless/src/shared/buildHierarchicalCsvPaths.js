/**
 * @file buildHierarchicalCsvPaths.js
 * @description Builds hierarchical CSV paths for a given scheme and concept map.
 */

import { cloneDeep } from 'lodash'

import { formatCsvPath } from '@/shared/formatCsvPath'
import { getNarrowers } from '@/shared/getNarrowers'
import { isCsvLongNameFlag } from '@/shared/isCsvLongNameFlag'
import { isCsvProviderUrlFlag } from '@/shared/isCsvProviderUrlFlag'

/**
 * Builds hierarchical CSV paths recursively.
 *
 * @param {number} csvHeadersCount - The number of CSV headers.
 * @param {Object} providerUrlsMap - Map of provider URLs.
 * @param {Object} longNamesMap - Map of long names.
 * @param {Object} scheme - The scheme object.
 * @param {Object} n - The current node in the hierarchy.
 * @param {Object} map - The concept map.
 * @param {Array} path - The current path (default: []).
 * @param {Array} paths - The array to store all paths (default: []).
 * @returns {Promise<void>}
 */
// eslint-disable-next-line max-len
export const buildHierarchicalCsvPaths = async (csvHeadersCount, providerUrlsMap, longNamesMap, scheme, n, map, path = [], paths = []) => {
  const { narrowerPrefLabel, uri } = n

  // Extract UUID from the URI
  const uuid = n.uri?.split('/')[n.uri.split('/').length - 1]
  const longNameArray = longNamesMap[n.uri]
  const providerUrlsArray = providerUrlsMap[n.uri]

  path.push(narrowerPrefLabel)

  const narrowers = getNarrowers(uri, map)
  const isLeaf = narrowers.length === 0

  // Recursively process narrower concepts
  // eslint-disable-next-line no-restricted-syntax
  for (const obj of narrowers) {
    // eslint-disable-next-line max-len
    buildHierarchicalCsvPaths(csvHeadersCount, providerUrlsMap, longNamesMap, scheme, obj, map, cloneDeep(path), paths)
  }

  if (path.length > 1) {
    // Remove the first element of the path
    path.shift()

    // Format the CSV path
    formatCsvPath(scheme, csvHeadersCount, path, isLeaf)

    // Add long name if required by the scheme
    if (isCsvLongNameFlag(scheme)) {
      if (longNameArray) {
        path.push(longNameArray[0])
      } else {
        path.push(' ')
      }
    }

    // Add provider URL if required by the scheme
    if (isCsvProviderUrlFlag(scheme)) {
      if (providerUrlsArray) {
        path.push(providerUrlsArray[0])
      } else {
        path.push(' ')
      }
    }

    // Add UUID to the path
    path.push(uuid)

    // Add the completed path to the paths array
    paths.push(path)
  }
}
