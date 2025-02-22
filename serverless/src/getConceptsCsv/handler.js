import getPaths from '../utils/getPaths'
import createCsv from '../utils/createCsv'
import { getApplicationConfig } from '../utils/getConfig'
import getCsvHeaders from '../utils/getCsvHeaders'
import getCsvMetadata from '../utils/getCsvMetadata'

const getConceptsCsv = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { queryStringParameters } = event
  const { scheme } = queryStringParameters

  try {
    const csvMetadata = await getCsvMetadata(scheme)

    const csvHeaders = await getCsvHeaders(scheme)
    let maxLevel = csvHeaders.length - 2
    if (scheme === 'providers') {
      maxLevel -= 1
    }

    const paths = await getPaths(scheme, maxLevel)

    return {
      body: await createCsv(csvMetadata, csvHeaders, paths),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error(`Error retrieving full path, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getConceptsCsv
