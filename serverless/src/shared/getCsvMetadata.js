import { format } from 'date-fns'

import {
  getConceptSchemeDetailsQuery
} from '@/shared/operations/queries/getConceptSchemeDetailsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'
/**
 * Generates metadata for CSV files
 * @param {string} scheme - The scheme name for the XML representation URL
 * @returns {string[]} An array of metadata strings
 */
const getCsvMetadata = async (scheme) => {
  let updateDate = 'N/A'
  try {
    // Make a SPARQL request to fetch concept scheme details
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptSchemeDetailsQuery(scheme)
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Extract the triples from the response
    const triples = json.results.bindings

    // Get the CSV headers string from the first triple
    updateDate = triples[0]?.modified?.value
  } catch (error) {
    // Log and re-throw any errors that occur during the process
    console.error('Error fetching triples:', error)
    throw error
  }

  // Initialize an empty array to store metadata
  const metadata = []
  // Add standard metadata information
  metadata.push('Keyword Version: N')
  metadata.push(`Revision: ${updateDate}`)
  // Add timestamp in the format 'yyyy-MM-dd HH:mm:ss'
  metadata.push(`Timestamp: ${format(Date.now(), 'yyyy-MM-dd HH:mm:ss')}`)
  // Add Terms of Use URL
  metadata.push('Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf')
  // Add URL for the most up-to-date XML representations
  metadata.push(`The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}/?format=xml`)

  // Return the completed metadata array
  return metadata
}

// Export the function as the default export
export default getCsvMetadata
