// eslint-disable-next-line no-unused-vars
import https from 'https'

import fetch from 'node-fetch'

import { importConceptData } from '@/shared/importConceptData'
import { updateVersionMetadata } from '@/shared/updateVersionMetadata'
/**
 * Handler to synchronize concept data.
 *
 * This function can be triggered by an HTTP POST request or a scheduled event.
 * It fetches concept data in JSON format, then imports this data.
 *
 * @param {Object} event - The event object from API Gateway or CloudWatch Events
 * @param {string} [event.body] - JSON string containing version and versionType (for HTTP events)
 * @param {string} [event.version] - Version of the concepts to sync (for scheduled events)
 * @returns {Promise<Object>} A promise that resolves to the response object
 * @throws {Error} If required parameters are missing or empty
 * @throws {Error} If SYNC_API_ENDPOINT is not set
 * @throws {Error} If an error occurs during the sync process
 *
 * @example
 * // Invoke via curl (replace YOUR_API_ENDPOINT with the actual endpoint):
 * curl -X POST http://localhost:4001/dev/sync-concept-data \
 *   -H "Content-Type: application/json" \
 *   -d '{"version": "published"}'
 */
export const syncConceptData = async (event) => {
  const fetchLegacyData = async (apiEndpoint, format, version) => {
    let baseUrl = `${apiEndpoint}/kms/concepts_to_rdf_repo?format=${format}`
    if (version && version !== 'published') {
      baseUrl += `&version=${version}`
    }

    const url = `${baseUrl}`
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false
    })
    const response = await fetch(url, { agent: httpsAgent })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    return response.text()
  }

  try {
    // Check if synchronization should occur
    if (process.env.SHOULD_SYNC !== 'true') {
      console.log('Sync is disabled')

      return {
        statusCode: 200,
        body: JSON.stringify({ message: 'Sync is disabled' })
      }
    }

    // Check if the API endpoint is configured
    if (!process.env.SYNC_API_ENDPOINT) {
      throw new Error('SYNC_API_ENDPOINT environment variable is not set')
    }

    let version

    if (event.body) {
      // This is an HTTP event
      ({ version } = event.body)
    } else if (event.version) {
      // This is a scheduled event
      ({ version } = event)
    } else {
      throw new Error('Missing required parameters: version')
    }

    console.log('version=', version)

    if (!version) {
      throw new Error('Invalid parameters: version must not be empty')
    }

    const apiEndpoint = process.env.SYNC_API_ENDPOINT

    let versionType = 'past_published'

    if (version === 'published' || version === 'draft') {
      versionType = version
    }

    // Fetch JSON and XML content using fetchPagedConceptData

    const jsonContent = await fetchLegacyData(apiEndpoint, 'json', version)

    await importConceptData(jsonContent, version, versionType)

    console.log('Concept data synchronized successfully')

    const now = new Date().toISOString()
    await updateVersionMetadata({
      graphId: version,
      lastSynced: now
    })

    console.log(`Updated lastSynced date to ${now} for version ${version}`)

    return {
      statusCode: 200,
      body: JSON.stringify({ message: 'Sync process complete.' })
    }
  } catch (error) {
    console.error('Error syncing concept data:', error)

    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    }
  }
}

export default syncConceptData
