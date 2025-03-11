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
        cmrScheme: {
          uuid: conceptId
        }
      }
    }
  } else if (['project', 'ProductLevelId'].includes(cmrScheme)) {
    const jsonQuery = {
      condition: {
        cmrScheme: prefLabel
      }
    }
  } else if (['DataFormat', 'GranuleDataFormat'].includes(cmrScheme)) {
    const queryString = `${cmrScheme}=${prefLabel}`
  }
}
