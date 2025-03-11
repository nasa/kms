import { cmrRequest } from './cmrRequest'

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

export const getNumberOfCmrCollections = async ({
  scheme,
  conceptId,
  prefLabel
}) => {
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

      return -1
    }
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

      return -1
    }
  } else {
    const queryString = `${cmrScheme}=${prefLabel}`
    try {
      const numberOfCollections = await doRequest('GET', queryString)

      return numberOfCollections
    } catch (error) {
      console.error('Error in getNumberOfCmrCollections:', error)

      return -1
    }
  }
}
