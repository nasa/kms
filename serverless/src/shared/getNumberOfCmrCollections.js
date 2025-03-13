/**
 * @fileoverview This module provides functionality to retrieve the number of CMR collections
 * based on various search criteria.
 *
 * @example
 * // Example 1: Searching by science keywords
 * const scienceKeywordsResult = await getNumberOfCmrCollections({
 *   scheme: 'sciencekeywords',
 *   conceptId: '1234-5678-9ABC-DEF0'
 * });
 * console.log(scienceKeywordsResult); // Outputs: 42 (or whatever the actual count is)
 *
 * @example
 * // Example 2: Searching by project
 * const projectResult = await getNumberOfCmrCollections({
 *   scheme: 'projects',
 *   prefLabel: 'CALIPSO'
 * });
 * console.log(projectResult); // Outputs: 15 (or whatever the actual count is)
 *
 * @example
 * // Example 3: Searching by a custom scheme
 * const customResult = await getNumberOfCmrCollections({
 *   scheme: 'custom_scheme',
 *   prefLabel: 'custom_value'
 * });
 * console.log(customResult); // Outputs: 3 (or whatever the actual count is)
 */

import { cmrRequest } from './cmrRequest'

/**
 * Performs a CMR request and returns the number of hits
 * @param {string} method - The HTTP method to use (GET or POST)
 * @param {object|string} query - The query parameters or body
 * @returns {Promise<number>} The number of CMR hits
 */
const doRequest = async (method, query) => {
  const response = await cmrRequest({
    path: method === 'POST' ? '/search/collections' : '/search/collections?'.concat(query),
    method,
    contentType: 'application/json',
    accept: 'application/json',
    body: method === 'POST' ? JSON.stringify(query) : null
  })

  // Check if the response is successful
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const cmrHits = Number(response.headers.get('cmr-hits')) || 0

  return cmrHits
}

/**
 * Gets the number of CMR collections based on the provided parameters
 * @param {object} params - The parameters object
 * @param {string} params.scheme - The scheme to use for the query
 * @param {string} params.conceptId - The concept ID
 * @param {string} params.prefLabel - The preferred label
 * @returns {Promise<number|null>} The number of collections or null if an error occurs
 */
export const getNumberOfCmrCollections = async ({
  scheme,
  conceptId,
  prefLabel
}) => {
  // Map the input scheme to the corresponding CMR scheme
  let cmrScheme
  switch (scheme.toLowerCase()) {
    case 'sciencekeywords':
      cmrScheme = 'science_keywords'
      break
    case 'platforms':
      cmrScheme = 'platform'
      break
    case 'instruments':
      cmrScheme = 'instrument'
      break
    case 'locations':
      cmrScheme = 'location_keyword'
      break
    case 'projects':
      cmrScheme = 'project'
      break
    // Add more cases as needed
    default:
      cmrScheme = scheme // Use the original value if no match is found
  }

  // Handle schemes that use UUID
  if (['science_keywords', 'platform', 'instrument', 'location_keyword'].includes(cmrScheme)) {
    const jsonQuery = {
      condition: {
        [cmrScheme]: {
          uuid: conceptId
        }
      }
    }
    try {
      const numberOfCollections = await doRequest('POST', jsonQuery)

      return numberOfCollections
    } catch (error) {
      console.error('Error in getNumberOfCmrCollections:', error)

      return null
    }
  // Handle schemes that use prefLabel
  } else if (['project', 'ProductLevelId'].includes(cmrScheme)) {
    const jsonQuery = {
      condition: {
        [cmrScheme]: prefLabel
      }
    }
    try {
      const numberOfCollections = await doRequest('POST', jsonQuery)

      return numberOfCollections
    } catch (error) {
      console.error('Error in getNumberOfCmrCollections:', error)

      return null
    }
  // Handle all other schemes
  } else {
    const queryString = `${cmrScheme}=${prefLabel}`
    try {
      const numberOfCollections = await doRequest('GET', queryString)

      return numberOfCollections
    } catch (error) {
      console.error('Error in getNumberOfCmrCollections:', error)

      return null
    }
  }
}
