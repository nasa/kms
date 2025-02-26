import { stringify } from 'csv'

/**
 * Create CSV output from the provided metadata, headers, and values
 * @param {String[]} csvMetadata - Metadata to be included at the top of the CSV
 * @param {String[]} csvHeaders - Headers for the CSV columns
 * @param {Array<Array<String>>} values - 2D array of data to be converted to CSV
 * @returns {Promise<String>} A promise that resolves with the CSV string output
 */
// eslint-disable-next-line max-len
export const createCsv = async (csvMetadata, csvHeaders, values) => new Promise((resolve, reject) => {
  // Add metadata and headers to the beginning of the values array
  values.splice(0, 0, csvMetadata)
  values.splice(1, 0, csvHeaders)

  // Use csv-stringify to convert the 2D array to CSV format
  stringify(values, { quoted: true }, (err, output) => {
    if (err) {
      // If there's an error during CSV creation, reject the promise
      reject(err)
    } else {
      // If successful, resolve the promise with the CSV output
      resolve(output)
    }
  })
})
