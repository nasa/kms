import { cmrGetRequest, cmrPostRequest } from './cmrRequest'

/**
 * Performs a CMR request and returns the number of hits
 * @param {string} method - The HTTP method to use (GET or POST)
 * @param {object|string} query - The query parameters or body
 * @returns {Promise<number>} The number of CMR hits
 */
const doRequest = async (method, query) => {
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

  // Check if the response is successful
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`)
  }

  const cmrHits = Number(response.headers.get('cmr-hits')) || 0

  return cmrHits
}

export const getJsonQueryForKeywordHierarchy = ({
  scheme,
  hierarchyFields,
  keywordList,
  prefLabelField,
  prefLabel
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
    sb.push(`"${prefLabelField}":"${prefLabel}"`)
  }

  // Always add ignore_case
  sb.push('"ignore_case":false')

  const query = `{"condition":{"${scheme}":{${sb.join(', ')}}}}`

  return JSON.parse(query)
}

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

  // Handle schemes that use UUID
  if (['science_keywords', 'platform', 'instrument', 'location_keyword'].includes(cmrScheme)) {
    const jsonQuery = {
      condition: {
        [cmrScheme]: {
          uuid
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
  } else if (['data_center'].includes(cmrScheme)) {
    const hierarchyFields = ['level_0', 'level_1', 'level_2', 'level_3']
    let keywordList = fullPath.split('|')
    let jsonQuery
    if (isLeaf) {
      if (keywordList.length > 1) {
        keywordList = keywordList.slice(0, -1)
      }

      const prefLabelField = 'short_name'
      jsonQuery = getJsonQueryForKeywordHierarchy({
        scheme: cmrScheme,
        hierarchyFields,
        keywordList,
        prefLabelField,
        prefLabel
      })
    } else {
      jsonQuery = getJsonQueryForKeywordHierarchy({
        scheme: cmrScheme,
        hierarchyFields,
        keywordList,
        prefLabelField: null,
        prefLabel: null
      })
    }

    try {
      const numberOfCollections = await doRequest('POST', jsonQuery)

      return numberOfCollections
    } catch (error) {
      console.error('Error in getNumberOfCmrCollections:', error)

      return null
    }
  } else if (['processing_level_id'].includes(cmrScheme)) {
    const query = `{"condition":{"${cmrScheme}":"${prefLabel}"}}`
    try {
      const numberOfCollections = await doRequest('POST', JSON.parse(query))

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
