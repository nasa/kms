import { XMLParser } from 'fast-xml-parser'

import { cmrGetRequest } from './cmrGetRequest'
import { cmrPostRequest } from './cmrPostRequest'
import { VALID_SCHEMES } from './constants/validSchemes'
import { logger } from './logger'

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

  const getJsonQueryForKeywordHierarchy = ({
    schemeParam,
    hierarchyFields,
    keywordList,
    prefLabelField,
    prefLabelParam
  }) => {
    const sb = []

    for (let i = 0; i < Math.min(hierarchyFields.length, keywordList.length); i += 1) {
      const name = hierarchyFields[i]
      const value = keywordList[i]

      if (value != null && value !== '') {
        sb.push(`"${name}":"${value}"`)
      }
    }

    if (prefLabel != null) {
      sb.push(`"${prefLabelField}":"${prefLabelParam}"`)
    }

    // Always add ignore_case
    sb.push('"ignore_case":false')

    const query = `{"condition":{"${schemeParam}":{${sb.join(', ')}}}}`
    logger.debug('Generated JSON query:', query)

    return JSON.parse(query)
  }

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
    case 'providers':
      cmrScheme = 'data_center'
      break
    case 'productlevelid':
      cmrScheme = 'processing_level_id'
      break
    case 'dataformat':
    case 'granuledataformat':
      cmrScheme = 'granule_data_format'
      break
    // Add more cases as needed
    default:
      cmrScheme = scheme // Use the original value if no match is found
  }

  logger.debug('Mapped CMR scheme:', cmrScheme)

  try {
    let numberOfCollections

    // Handle schemes that use UUID
    if (['science_keywords', 'platform', 'instrument', 'location_keyword'].includes(cmrScheme)) {
      const jsonQuery = {
        condition: {
          [cmrScheme]: {
            uuid
          }
        }
      }
      logger.debug('Using UUID-based query:', JSON.stringify(jsonQuery))
      numberOfCollections = await doRequest('POST', jsonQuery)
    // Handle schemes that use prefLabel
    } else if (['project', 'ProductLevelId'].includes(cmrScheme)) {
      const jsonQuery = {
        condition: {
          [cmrScheme]: prefLabel
        }
      }
      logger.debug('Using prefLabel-based query:', JSON.stringify(jsonQuery))
      numberOfCollections = await doRequest('POST', jsonQuery)
    } else if (['data_center'].includes(cmrScheme)) {
      const hierarchyFields = ['level_0', 'level_1', 'level_2', 'level_3']
      let keywordList = fullPath.split('|')
      logger.debug('Data center keyword list:', keywordList)
      let jsonQuery
      if (isLeaf) {
        if (keywordList.length > 1) {
          keywordList = keywordList.slice(0, -1)
        }

        const prefLabelField = 'short_name'
        jsonQuery = getJsonQueryForKeywordHierarchy({
          schemeParam: cmrScheme,
          hierarchyFields,
          keywordList,
          prefLabelField,
          prefLabelParam: prefLabel
        })
      } else {
        jsonQuery = getJsonQueryForKeywordHierarchy({
          schemeParam: cmrScheme,
          hierarchyFields,
          keywordList,
          prefLabelField: null,
          prefLabelParam: null
        })
      }

      logger.debug('Using data center query:', JSON.stringify(jsonQuery))
      numberOfCollections = await doRequest('POST', jsonQuery)
    } else if (['processing_level_id'].includes(cmrScheme)) {
      const query = `{"condition":{"${cmrScheme}":"${prefLabel}"}}`
      logger.debug('Using processing_level_id query:', query)
      numberOfCollections = await doRequest('POST', JSON.parse(query))
    // Handle all other schemes
    } else {
      const queryString = `${cmrScheme}=${encodeURIComponent(prefLabel)}`
      logger.debug('Using GET request with query string:', queryString)
      numberOfCollections = await doRequest('GET', queryString)
    }

    logger.info('Number of collections found:', numberOfCollections)

    return numberOfCollections
  } catch (error) {
    logger.error('Error in getNumberOfCmrCollections:', error)
    logger.error('Error stack:', error.stack)

    return null
  }
}
