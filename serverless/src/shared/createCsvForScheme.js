import { createCsv } from './createCsv'
import { createCsvMetadata } from './createCsvMetadata'
import { generateCsvHeaders } from './generateCsvHeaders'
import { getApplicationConfig } from './getConfig'
import { getCsvHeaders } from './getCsvHeaders'
import { getCsvPaths } from './getCsvPaths'
import { getMaxLengthOfSubArray } from './getMaxLengthOfSubArray'

const inFlightCsvBySchemeVersion = new Map()
const shouldLogInFlight = () => process.env.LOG_IN_FLIGHT_REQUESTS === 'true'

export const resetCreateCsvForSchemeStateForTests = () => {
  inFlightCsvBySchemeVersion.clear()
}

/**
 * Creates a CSV file for the specified scheme.
 *
 * @param {Object} params - The parameters for creating the CSV.
 * @param {string} params.scheme - The scheme name.
 * @param {string} params.version - The version parameter.
 * @param {string} params.versionName - The name of the version.
 * @param {string} params.versionCreationDate - The creation date of the version.
 * @returns {Promise<Object>} A promise that resolves to an object containing the CSV data and response details.
 */
export const createCsvForScheme = async ({
  scheme, version, versionName, versionCreationDate
}) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const key = JSON.stringify({
    scheme: (scheme || '').toLowerCase(),
    version: version || 'published'
  })
  const inFlight = inFlightCsvBySchemeVersion.get(key)
  if (inFlight) {
    if (shouldLogInFlight()) {
      console.log(`[single-flight] Reusing in-flight createCsvForScheme request key=${key}`)
    }

    return inFlight
  }

  const requestPromise = (async () => {
    try {
      // Create CSV metadata
      const csvMetadata = createCsvMetadata({
        versionName,
        versionCreationDate,
        scheme
      })
      // Get CSV headers
      let csvHeaders = await getCsvHeaders(scheme, version)
      // Calculate CSV header count
      const csvHeadersCount = csvHeaders.length
      // Get CSV row data
      const paths = await getCsvPaths(scheme, csvHeadersCount, version)
      // If no headers were retrieved, generate them based on the maximum number of columns in the paths
      if (csvHeaders.length === 0) {
        const maxColumns = getMaxLengthOfSubArray(paths)
        csvHeaders = await generateCsvHeaders(scheme, version, maxColumns)
      }

      // Sort output
      paths.sort((line1, line2) => {
        // eslint-disable-next-line no-plusplus
        for (let i = 0; i < Math.min(line1.length, line2.length); i++) {
          if (line1[i] !== line2[i]) {
            return line1[i].localeCompare(line2[i])
          }
        }

        // If all elements up to the length of the shorter array are equal,
        // sort by array length (shorter arrays come first)
        return line1.length - line2.length
      })

      // Set CSV response header
      const responseHeaders = {
        ...defaultResponseHeaders,
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename=${scheme}.csv`
      }

      return {
        statusCode: 200,
        body: await createCsv(csvMetadata, csvHeaders, paths),
        headers: responseHeaders
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
    } finally {
      inFlightCsvBySchemeVersion.delete(key)
    }
  })()

  inFlightCsvBySchemeVersion.set(key, requestPromise)

  return requestPromise
}
