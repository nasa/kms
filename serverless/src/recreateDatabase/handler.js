import { getApplicationConfig } from '@/shared/getConfig'

/**
 * Handler for recreating the RDF4J database repository.
 *
 * This function performs the following operations:
 * 1. Deletes the existing repository if it exists.
 * 2. Creates a new repository with the specified configuration.
 *
 * Environment Variables:
 * - RDF4J_SERVICE_URL: The base URL of the RDF4J service.
 *
 * @async
 * @function recreateDatabase
 * @returns {Object} An object containing:
 *   - statusCode: HTTP status code (200 for success, 500 for error)
 *   - headers: Response headers
 *   - body: A JSON string containing a success message or error details
 *
 * @throws Will throw an error if:
 *   - The deletion of the existing repository fails (except for 404 Not Found)
 *   - The creation of the new repository fails
 *
 * Repository Configuration:
 * - ID: 'kms'
 * - Type: Native Store
 * - Properties:
 *   - forceSync: true
 *   - memory: false
 *   - reindex: true
 *   - writeThrough: true
 *
 * Authentication:
 * Uses Basic Authentication with username 'rdf4j' and password 'rdf4j'.
 *
 * Error Handling:
 * If any error occurs during the process, it logs the error details and returns a 500 status code
 * with error information in the response body.
 *
 * Usage:
 * This handler can be invoked to completely reset the RDF4J repository to a clean state.
 * Use with caution as it will delete all existing data in the repository.
 *
 * @example
 * curl -X POST https://your-api-endpoint.com/recreate-database \
 *   -H "Authorization: Bearer YOUR_AUTH_TOKEN"
 *
 * // Response:
 * // {
 * //   "statusCode": 200,
 * //   "headers": {
 * //     "Content-Type": "application/json",
 * //     "Access-Control-Allow-Origin": "*"
 * //   },
 * //   "body": "{\"message\":\"Successfully recreated repository 'kms'\"}"
 * // }
 */
export const recreateDatabase = async () => {
  const { defaultResponseHeaders } = getApplicationConfig()
  const rdf4jServiceUrl = process.env.RDF4J_SERVICE_URL

  const getAuthHeader = () => {
    const username = process.env.RDF4J_USER_NAME
    const password = process.env.RDF4J_PASSWORD

    return `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`
  }

  try {
    const baseUrl = `${rdf4jServiceUrl}/rdf4j-server`
    const repositoryId = 'kms'

    // Step 1: Delete existing repository
    const deleteResponse = await fetch(`${baseUrl}/repositories/${repositoryId}`, {
      method: 'DELETE',
      headers: {
        Authorization: getAuthHeader()
      }
    })

    if (!deleteResponse.ok && deleteResponse.status !== 404) {
      throw new Error(`Failed to delete repository: ${deleteResponse.status} ${deleteResponse.statusText}`)
    }

    console.log(`Deleted repository '${repositoryId}' (if it existed)`)

    // Step 2: Create new repository
    const createConfig = `
      #
      # RDF4J configuration template for a main-memory repository
      #
      @prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>.
      @prefix config: <tag:rdf4j.org,2023:config/>.

      [] a config:Repository ;
         config:rep.id "${repositoryId}" ;
         rdfs:label "${repositoryId}" ;
         config:rep.impl [
            config:rep.type "openrdf:SailRepository" ;
            config:sail.impl [
              config:sail.type "openrdf:NativeStore" ;
              config:native.forceSync true ;
              config:sail.memory "false" ;
              config:sail.reindex "true" ;
              config:sail.writeThrough "true" ;
          ]
         ].
    `

    const createResponse = await fetch(`${baseUrl}/repositories/${repositoryId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/x-turtle',
        Authorization: getAuthHeader()
      },
      body: createConfig
    })

    if (!createResponse.ok) {
      throw new Error(`Failed to create repository: ${createResponse.status} ${createResponse.statusText}`)
    }

    console.log(`Created new repository '${repositoryId}'`)

    return {
      statusCode: 200,
      headers: defaultResponseHeaders,
      body: JSON.stringify({ message: `Successfully recreated repository '${repositoryId}'` })
    }
  } catch (error) {
    console.error('Error recreating database:', error)
    console.error('RDF4J Service URL:', rdf4jServiceUrl)
    console.error('Full error object:', JSON.stringify(error, Object.getOwnPropertyNames(error)))

    return {
      statusCode: 500,
      headers: defaultResponseHeaders,
      body: JSON.stringify({
        error: 'Failed to recreate database',
        details: error.message
      })
    }
  }
}

export default recreateDatabase
