import { stringify } from 'csv'

/**
 * Create CSV output from the provided metadata, headers, and values
 * @param {String[]} csvMetadata - Metadata to be included at the top of the CSV
 * @param {String[]} csvHeaders - Headers for the CSV columns
 * @param {Array<Array<String>>} values - 2D array of data to be converted to CSV
 * @returns {Promise<String>} A promise that resolves with the CSV string output
 *
 * @example
 * // Basic usage
 * const metadata = ['Report Generated: 2023-06-01'];
 * const headers = ['Name', 'Age', 'City'];
 * const data = [
 *   ['John Doe', '30', 'New York'],
 *   ['Jane Smith', '25', 'Los Angeles']
 * ];
 *
 * createCsv(metadata, headers, data)
 *   .then(csv => console.log(csv))
 *   .catch(err => console.error(err));
 *
 * // Output:
 * // "Report Generated: 2023-06-01"
 * // "Name","Age","City"
 * // "John Doe","30","New York"
 * // "Jane Smith","25","Los Angeles"
 *
 * @example
 * // Using async/await
 * async function generateReport() {
 *   const metadata = ['Quarterly Sales Report', 'Q2 2023'];
 *   const headers = ['Product', 'Units Sold', 'Revenue'];
 *   const data = [
 *     ['Widget A', '1000', '$10000'],
 *     ['Widget B', '500', '$7500'],
 *     ['Widget C', '750', '$11250']
 *   ];
 *
 *   try {
 *     const csv = await createCsv(metadata, headers, data);
 *     console.log(csv);
 *   } catch (err) {
 *     console.error('Error generating CSV:', err);
 *   }
 * }
 *
 * generateReport();
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
