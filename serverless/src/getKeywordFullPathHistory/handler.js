import { buildFullPath } from '@/shared/buildFullPath'
import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionNames } from '@/shared/getVersionNames'

/**
 * Retrieves the full path history for a keyword across different versions.
 *
 * @param {Object} event - The event object containing the request details.
 * @param {Object} event.pathParameters - The path parameters of the request.
 * @param {string} event.pathParameters.uuid - The UUID of the keyword.
 *
 * @returns {Object} The response object containing the keyword version report.
 *
 * @example
 * // Example event object
 * const event = {
 *   pathParameters: {
 *     uuid: '123e4567-e89b-12d3-a456-426614174000'
 *   }
 * };
 *
 * // Example usage
 * const response = await getKeywordFullPathHistory(event);
 * console.log(response);
 *
 * // Example response
 * {
 *   statusCode: 200,
 *   body: JSON.stringify({
 *     KeywordVersionReport: [
 *       { Version: 'v1', FullPath: '/path/to/keyword/v1' },
 *       { Version: 'v2', FullPath: '/path/to/keyword/v2' },
 *       { Version: 'v3', FullPath: '/path/to/keyword/v3' }
 *     ]
 *   }, null, 2),
 *   headers: { ... }
 * }
 *
 * @throws {Error} If there's an error retrieving the full path history.
 *
 * @example
 * // Example error response
 * {
 *   statusCode: 500,
 *   body: JSON.stringify({
 *     error: 'Error message'
 *   }),
 *   headers: { ... }
 * }
 */
export const getKeywordFullPathHistory = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const { uuid } = event.pathParameters
  try {
    const versionNames = await getVersionNames()
    const createVersionObjects = async (arr) => {
      const promises = arr.map(async (item) => ({
        Version: item,
        FullPath: await buildFullPath(uuid, item)
      }))

      return Promise.all(promises)
    }

    const resultArray = await createVersionObjects(versionNames)
    const result = {
      KeywordVersionReport: resultArray
    }

    return {
      statusCode: 200,
      body: JSON.stringify(result, null, 2),
      headers: defaultResponseHeaders
    }
  } catch (error) {
  // Log and return error response
    console.error(`Error retrieving fullpath history, error=${error.toString()}`)

    return {
      headers: defaultResponseHeaders,
      statusCode: 500,
      body: JSON.stringify({
        error: error.toString()
      })
    }
  }
}

export default getKeywordFullPathHistory
