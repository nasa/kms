import { cmrRequest } from './cmrRequest'

const postRequest = async (jsonQuery) => {
  const response = await cmrRequest({
    path: '/search/collections',
    method: 'POST',
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify(jsonQuery)
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
      const numberOfCollections = await postRequest(jsonQuery)

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
      const numberOfCollections = await postRequest(jsonQuery)

      return numberOfCollections
    } catch (error) {
      console.error('Error in getNumberOfCmrCollections:', error)

      return -1
    }
  } else if (['DataFormat', 'GranuleDataFormat'].includes(cmrScheme)) {
    const queryString = `${cmrScheme}=${prefLabel}`
  }
}
