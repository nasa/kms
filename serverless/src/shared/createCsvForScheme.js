import { createCsv } from './createCsv'
import { generateCsvHeaders } from './generateCsvHeaders'
import { getApplicationConfig } from './getConfig'
import { getCsvHeaders } from './getCsvHeaders'
import { getCsvMetadata } from './getCsvMetadata'
import { getCsvPaths } from './getCsvPaths'
import { getMaxLengthOfSubArray } from './getMaxLengthOfSubArray'

/**
 * Creates a CSV file for a specified scheme.
 *
 * This function generates a CSV file containing data for a given scheme. It retrieves
 * metadata, headers, and row data for the scheme, then compiles this information into
 * a CSV format. The function handles both successful CSV creation and error scenarios.
 *
 * @async
 * @function createCsvForScheme
 * @param {string} scheme - The identifier for the scheme for which to create the CSV.
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   @property {number} statusCode - HTTP status code (200 for success, 500 for error).
 *   @property {string} body - CSV data as a string (for success) or error message (for failure).
 *   @property {Object} headers - HTTP headers for the response.
 *
 * @throws Will throw an error if there's an issue retrieving data or creating the CSV.
 *
 * @example
 * const result = await createCsvForScheme('exampleScheme');
 * if (result.statusCode === 200) {
 *   console.log('CSV created successfully');
 * } else {
 *   console.error('Failed to create CSV:', result.body);
 * }
 */

export const createCsvForScheme = async (scheme) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  try {
    // Get CSV output metadata
    const csvMetadata = await getCsvMetadata(scheme)
    // Get CSV headers
    let csvHeaders = await getCsvHeaders(scheme)
    // Calculate CSV header count
    const csvHeadersCount = csvHeaders.length
    // Get CSV row data
    const paths = await getCsvPaths(scheme, csvHeadersCount)
    // If no headers were retrieved, generate them based on the maximum number of columns in the paths
    if (csvHeaders.length === 0) {
      const maxColumns = getMaxLengthOfSubArray(paths)
      csvHeaders = generateCsvHeaders(scheme, maxColumns)
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
  }
}
