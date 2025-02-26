import { stringify } from 'csv'

/**
 * Create CSV output from the 2-dimensional array
 * @param {String[]} csvMetadata - Array containing metadata information
 * @param {String[]} csvHeaders - Array containing header row information
 * @param {String[][]} values - 2D array containing the data values
 * @returns {String|Error} - Returns CSV string or Error object
 */
export const createCsv = (csvMetadata, csvHeaders, values) => {
  try {
    // Combine metadata, headers, and values into a single 2D array
    const data = [csvMetadata, csvHeaders, ...values]

    let result = ''

    // Use csv-stringify to convert the data array into CSV format
    stringify(data, { quoted: true }, (err, output) => {
      if (err) {
        // If there's an error during stringification, throw it
        throw err
      }

      // Store the CSV output in the result variable
      result = output
    })

    // Return the CSV string
    return result
  } catch (error) {
    // If any error occurs during the process, return the error object
    return error
  }
}
