import { getConcepts } from '@/getConcepts/handler'
import { logger } from '@/shared/logger'

/**
 * Downloads concepts for a given concept scheme in the specified format.
 *
 * Creates a simulated API Gateway event and calls the getConcepts handler directly
 * to retrieve concept data. Handles multiple formats (CSV, JSON, RDF, XML), with error
 * handling for missing schemes and other failures.
 *
 * @async
 * @param {Object} params - The download parameters
 * @param {string} params.conceptScheme - The identifier of the concept scheme to download
 * @param {string} [params.format='csv'] - The desired output format ('csv', 'json', 'rdf', or 'xml')
 * @param {string} [params.version='published'] - The version of concepts to retrieve
 * @returns {Promise<string|Object>} The concept data (string for CSV/RDF/XML, object for JSON)
 * @throws {Error} Throws an error if the download fails, with additional properties:
 *   - statusCode: HTTP status code from the handler
 *
 * @example
 * // Download concepts as CSV
 * const csvData = await downloadConcepts({
 *   conceptScheme: 'my-scheme',
 *   format: 'csv'
 * });
 *
 * @example
 * // Download concepts as JSON
 * const jsonData = await downloadConcepts({
 *   conceptScheme: 'my-scheme',
 *   format: 'json',
 *   version: 'draft'
 * });
 *
 * @example
 * // Download concepts as RDF
 * const rdfData = await downloadConcepts({
 *   conceptScheme: 'my-scheme',
 *   format: 'rdf'
 * });
 */
export const downloadConcepts = async ({ conceptScheme, format = 'csv', version = 'published' }) => {
  logger.debug(`Downloading ${format.toUpperCase()} for concept scheme: ${conceptScheme}, version: ${version}`)

  try {
    // Create an event object similar to what API Gateway would pass to the Lambda function
    const event = {
      pathParameters: { conceptScheme },
      queryStringParameters: {
        format,
        version
      },
      resource: '/concepts/concept_scheme/{conceptScheme}'
    }

    // Call the handler directly
    const result = await getConcepts(event)

    if (result.statusCode !== 200) {
      const errorBody = JSON.parse(result.body)
      const detail = errorBody.error ? ` - ${errorBody.error}` : ''
      const error = new Error(`Failed to download ${format.toUpperCase()}. Status: ${result.statusCode}${detail}`)
      error.statusCode = result.statusCode
      throw error
    }

    // Parse the result based on the format
    let content
    if (format.toLowerCase() === 'json') {
      content = JSON.parse(result.body)
    } else {
      content = result.body
    }

    logger.debug(`Received ${format.toUpperCase()} content`)

    return content
  } catch (error) {
    logger.error(`Error downloading ${format.toUpperCase()} for ${conceptScheme}:`, error.message)
    throw error
  }
}
