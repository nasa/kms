import deleteAllTriples from '../utils/deleteAllTriples'
import { getApplicationConfig } from '../utils/getConfig'

/**
 * Deletes all triples from the RDF store.
 * @todo: This function is intended for use in development and testing environments only.
 * THIS IS A DANGEROUS OPERATION AND SHOULD BE USED WITH CAUTION.
 * This function is intended for use in development and testing environments only.
 *
 * This function attempts to delete all triples from the RDF store using the
 * deleteAllTriples utility function. It handles both successful deletions
 * and potential errors.
 *
 * @async
 * @function deleteAll
 * @returns {Promise<Object>} A promise that resolves to an object containing:
 *   - statusCode {number} - HTTP status code (200 for success, 500 for error)
 *   - body {string} - JSON stringified message and error (if applicable)
 *   - headers {Object} - Response headers
 *
 * @example
 * // Successful deletion
 * const result = await deleteAll();
 * console.log(result);
 * // {
 * //   statusCode: 200,
 * //   body: '{"message":"Successfully deleted all triples."}',
 * //   headers: { ... }
 * // }
 *
 * @example
 * // Error during deletion
 * const result = await deleteAll();
 * console.log(result);
 * // {
 * //   statusCode: 500,
 * //   body: '{"message":"Error deleting all triples","error":"HTTP error! status: 500"}',
 * //   headers: { ... }
 * // }
 */

const deleteAll = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()

  try {
    const response = await deleteAllTriples()

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    console.log('Successfully deleted all triples')

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Successfully deleted all triples.' }),
      headers: defaultResponseHeaders
    }
  } catch (error) {
    console.error('Error deleting all triples:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'Error deleting all triples',
        error: error.message
      }),
      headers: defaultResponseHeaders
    }
  }
}

export default deleteAll
