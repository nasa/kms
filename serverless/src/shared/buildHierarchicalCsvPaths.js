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
 * @param {Object} params - The parameters object.
 * @param {number} params.csvHeadersCount - The number of CSV headers.
 * @param {Object} params.providerUrlsMap - Map of provider URLs.
 * @param {Object} params.longNamesMap - Map of long names.
 * @param {Object} params.scheme - The scheme object.
 * @param {Object} params.n - The current node in the hierarchy.
 * @param {Object} params.map - The concept map.
 * @param {Array} [params.path=[]] - The current path.
 * @param {Array} [params.paths=[]] - The array to store all paths.
 * @returns {Promise<void>}
 *
 * @example
 * // Basic usage
 * await buildHierarchicalCsvPaths({
 *   csvHeadersCount: 3,
 *   providerUrlsMap: {
 *     'http://example.com/concept1': ['http://provider.com/1'],
 *     'http://example.com/concept2': ['http://provider.com/2']
 *   },
 *   longNamesMap: {
 *     'http://example.com/concept1': ['Long Name 1'],
 *     'http://example.com/concept2': ['Long Name 2']
 *   },
 *   scheme: 'myScheme',
 *   n: {
 *     narrowerPrefLabel: 'Root',
 *     uri: 'http://example.com/root'
 *   },
 *   map: new Map([
 *     ['http://example.com/root', [
 *       { narrowerPrefLabel: 'Child1', uri: 'http://example.com/concept1' },
 *       { narrowerPrefLabel: 'Child2', uri: 'http://example.com/concept2' }
 *     ]]
 *   ]),
 *   path: [],
 *   paths: []
 * });
 *
 * @example
 * // Usage within a larger function
 * export const getCsvPaths = async (scheme, csvHeadersCount) => {
 *   const root = await getRootConcept(scheme);
 *   const node = {
 *     narrowerPrefLabel: root?.prefLabel?.value,
 *     uri: root?.subject?.value
 *   };
 *   const narrowersMap = await getNarrowersMap(scheme);
 *   const longNamesMap = await getLongNamesMap(scheme);
 *   const providerUrlsMap = scheme === 'providers' ? await getProviderUrlsMap(scheme) : {};
 *   const keywords = [];
 *
 *   await buildHierarchicalCsvPaths({
 *     csvHeadersCount,
 *     providerUrlsMap,
 *     longNamesMap,
 *     scheme,
 *     n: node,
 *     map: narrowersMap,
 *     path: [],
 *     paths: keywords
 *   });
 *
 *   return keywords.reverse();
 * };
 */
export const buildHierarchicalCsvPaths = async (params) => {
  const {
    csvHeadersCount,
    providerUrlsMap,
    longNamesMap,
    scheme,
    n,
    map,
    path = [],
    paths
  } = params

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
    // eslint-disable-next-line no-await-in-loop
    await buildHierarchicalCsvPaths({
      ...params,
      n: obj,
      path: cloneDeep(path)
    })
  }

  if (path.length > 1) {
    // Remove the first element of the path
    path.shift()

    // Format the CSV path
    formatCsvPath(scheme, csvHeadersCount, path, isLeaf)

    // Add long name if required by the scheme
    if (isCsvLongNameFlag(scheme)) {
      path.push(longNameArray || '')
    }

    // Add provider URL if required by the scheme
    if (isCsvProviderUrlFlag(scheme)) {
      path.push(providerUrlsArray ? providerUrlsArray[0] : '')
    }

    // Add UUID to the path
    path.push(uuid)

    // Add the completed path to the paths array
    paths.push(path)
  }
}
