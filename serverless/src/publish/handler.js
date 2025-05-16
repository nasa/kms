import { getApplicationConfig } from '@/shared/getConfig'
import { getVersionMetadata } from '@/shared/getVersionMetadata'
import { getPublishUpdateQuery } from '@/shared/operations/updates/getPublishUpdateQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Initiates the publication process for a new version of the keyword set.
 *
 * This function handles the process of publishing a new version of the keyword set by
 * initiating an asynchronous SPARQL update operation. It performs the following steps:
 * 1. Validates the input to ensure a 'name' parameter is provided in the query string.
 * 2. Checks if the provided version name already exists.
 * 3. Retrieves metadata for the current published version.
 * 4. Generates a SPARQL update query to perform the following operations:
 *    - Move the current 'published' version to 'past_published' (if it exists).
 *    - Copy the 'draft' version to become the new 'published' version.
 *    - Update metadata for the new 'published' version with the provided name and timestamp.
 * 5. Initiates the SPARQL update request asynchronously.
 * 6. Returns immediately with a 202 (Accepted) status, indicating the process has been initiated.
 *
 * Note: The actual SPARQL update operation is performed asynchronously and its completion
 * is not awaited by this function.
 *
 * @async
 * @function publish
 * @param {Object} event - The event object passed from API Gateway.
 * @param {Object} event.queryStringParameters - The query string parameters from the API request.
 * @param {string} event.queryStringParameters.name - The name of the version to be published.
 * @returns {Promise<Object>} A promise that resolves to an object containing the response details.
 * @property {number} statusCode - The HTTP status code (202 for accepted, 400 for bad request, 500 for server error).
 * @property {Object} headers - The response headers, including CORS and content type settings.
 * @property {string} body - A JSON string containing the response message, version name, and submission date.
 *
 * @throws {Error} If there's an issue with input validation, version name checking, or initiating the publish process.
 *
 * @example
 * // Successful invocation
 * const event = { queryStringParameters: { name: 'v1.0.0' } };
 * const result = await publish(event);
 * // result = {
 * //   statusCode: 202,
 * //   headers: { 'Content-Type': 'application/json', ... },
 * //   body: '{"message":"Publish process initiated for version v1.0.0","version":"v1.0.0","submissionDate":"2023-06-01T12:00:00.000Z"}'
 * // }
 *
 * @example
 * // Failed invocation (missing name)
 * const event = { queryStringParameters: {} };
 * const result = await publish(event);
 * // result = {
 * //   statusCode: 400,
 * //   headers: { 'Content-Type': 'application/json', ... },
 * //   body: '{"message":"Error: \\"name\\" parameter is required in the query string"}'
 * // }
 */
export const publish = async (event) => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const name = event.queryStringParameters?.name

  const getVersionNames = async () => {
    const query = `
      PREFIX gcmd: <https://gcmd.earthdata.nasa.gov/kms#>
  
      SELECT DISTINCT ?versionName
      WHERE {
        GRAPH ?graph {
          ?s gcmd:versionName ?versionName .
        }
      }
      ORDER BY ?versionName
    `

    try {
      const response = await sparqlRequest({
        method: 'POST',
        contentType: 'application/sparql-query',
        accept: 'application/sparql-results+json',
        body: query
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const results = await response.json()

      return results.results.bindings.map((binding) => binding.versionName.value)
    } catch (error) {
      console.error('Error fetching version names:', error)
      throw error
    }
  }

  if (!name) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: 'Error: "name" parameter is required in the query string' })
    }
  }

  const versionNames = await getVersionNames()

  if (versionNames.includes(name)) {
    return {
      statusCode: 400,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: `Error: Version name "${name}" already exists` })
    }
  }

  try {
    const metadata = await getVersionMetadata('published')
    const updateDate = new Date().toISOString()

    const publishQuery = getPublishUpdateQuery(name, updateDate, metadata)

    // Launch the SPARQL update request asynchronously
    sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-update',
      accept: 'application/sparql-results+json',
      body: publishQuery
    }).then((response) => {
      if (!response.ok) {
        console.error(`Failed to execute batch update: ${response.status} ${response.statusText}`)

        return response.text()
      }

      console.log('Publish process completed successfully')

      return null // Explicitly return null for the success case
    }).then((errorText) => {
      if (errorText) console.error(`Error details: ${errorText}`)
    }).catch((error) => {
      console.error('Error in asynchronous publish process:', error)
    })

    // Return immediately with a "job submitted" message
    return {
      statusCode: 202,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: `Publish process initiated for version ${name}`,
        version: name,
        submissionDate: updateDate
      })
    }
  } catch (error) {
    console.error('Error in publish process setup:', error)

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        message: 'Error in initiating publish process',
        error: error.message
      })
    }
  }
}

export default publish
