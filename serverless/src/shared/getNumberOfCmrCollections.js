import { XMLParser } from 'fast-xml-parser'

import { cmrGetRequest } from './cmrGetRequest'
import { cmrPostRequest } from './cmrPostRequest'
import { VALID_SCHEMES } from './constants/validSchemes'
import { logger } from './logger'
import { createCmrCollectionQuery } from './redis-path-store/createCmrCollectionQuery'

/**
 * Gets the number of CMR collections based on the provided parameters
 * @param {object} params - The parameters object
 * @param {string} [params.scheme] - The scheme to use for the query (e.g., 'sciencekeywords', 'projects', 'providers')
 * @param {string} [params.uuid] - The concept ID (used for schemes like 'sciencekeywords', 'platforms', 'instruments', 'locations')
 * @param {string} [params.prefLabel] - The preferred label (used for schemes like 'projects', 'ProductLevelId', or as short_name for 'providers')
 * @param {string} [params.fullPath] - The full hierarchical path (used for 'providers' scheme)
 * @param {boolean} [params.isLeaf] - Indicates if the node is a leaf node (used for 'providers' scheme)
 * @returns {Promise<number|null>} The number of collections or null if an error occurs
 *
 * @example
 * // Example 1: Searching by science keywords
 * const scienceKeywordsCount = await getNumberOfCmrCollections({
 *   scheme: 'sciencekeywords',
 *   uuid: '1234-5678-9ABC-DEF0'
 * });
 *
 * @example
 * // Example 2: Searching by project
 * const projectCount = await getNumberOfCmrCollections({
 *   scheme: 'projects',
 *   prefLabel: 'CALIPSO'
 * });
 *
 * @example
 * // Example 3: Searching by data center (provider)
 * const providerCount = await getNumberOfCmrCollections({
 *   scheme: 'providers',
 *   fullPath: 'LEVEL_1|LEVEL_2|LEVEL_3',
 *   prefLabel: 'SHORT_NAME',
 *   isLeaf: true
 * });
 *
 * @example
 * // Example 4: Searching by instrument
 * const instrumentCount = await getNumberOfCmrCollections({
 *   scheme: 'instruments',
 *   uuid: 'ABCD-1234-5678-EFGH'
 * });
 */
export const getNumberOfCmrCollections = async ({
  scheme,
  uuid,
  prefLabel,
  fullPath,
  isLeaf
}) => {
  logger.info('getNumberOfCmrCollections called with params:', {
    scheme,
    uuid,
    prefLabel,
    fullPath,
    isLeaf
  })

  // Check if the scheme is valid to get number of CMR collections
  if (!VALID_SCHEMES.includes(scheme)) {
    logger.warn(`Invalid scheme, can't get number of CMR collections: ${scheme}`)

    return null
  }

  const doRequest = async (method, query) => {
    logger.debug(`Performing ${method} request to CMR with query:`, JSON.stringify(query))
    let response
    if (method === 'POST') {
      response = await cmrPostRequest({
        path: '/search/collections',
        contentType: 'application/json',
        accept: 'application/json',
        body: JSON.stringify(query)
      })
    } else {
      response = await cmrGetRequest({
        path: '/search/collections?'.concat(query)
      })
    }

    logger.debug('CMR response status:', response.status)

    // Check if the response is successful
    if (!response.ok) {
      const textContent = await response.text()
      let errorMessage = `HTTP error! status: ${response.status}`

      if (textContent.trim().startsWith('<?xml')) {
        const parser = new XMLParser()
        const xmlObj = parser.parse(textContent)
        if (xmlObj.errors && xmlObj.errors.error) {
          if (Array.isArray(xmlObj.errors.error)) {
            errorMessage = xmlObj.errors.error.join(', ')
          } else {
            errorMessage = xmlObj.errors.error
          }
        }
      } else {
        errorMessage = textContent || errorMessage
      }

      const error = new Error(errorMessage)
      error.status = response.status
      error.url = response.url
      throw error
    }

    const cmrHits = Number(response.headers.get('cmr-hits')) || 0
    logger.debug('CMR hits:', cmrHits)

    return cmrHits
  }

  try {
    const {
      cmrScheme,
      method,
      query,
      queryType
    } = createCmrCollectionQuery({
      scheme,
      uuid,
      prefLabel,
      fullPath,
      isLeaf
    })

    logger.debug('Mapped CMR scheme:', cmrScheme)

    if (queryType === 'uuid') {
      logger.debug('Using UUID-based query:', JSON.stringify(query))
    } else if (queryType === 'prefLabel') {
      logger.debug('Using prefLabel-based query:', JSON.stringify(query))
    } else if (queryType === 'hierarchy') {
      logger.debug('Using data center query:', JSON.stringify(query))
    } else {
      logger.debug('Using GET request with query string:', query)
    }

    const numberOfCollections = await doRequest(method, query)

    logger.info('Number of collections found:', numberOfCollections)

    return numberOfCollections
  } catch (error) {
    logger.error('Error in getNumberOfCmrCollections:', error)
    logger.error('Error stack:', error.stack)

    return null
  }
}
