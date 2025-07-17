import { format } from 'date-fns'

import {
  getConceptSchemeDetailsQuery
} from '@/shared/operations/queries/getConceptSchemeDetailsQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'
/**
 * Generates metadata for CSV files based on a specific scheme and version
 * @async
 * @function getCsvMetadata
 * @param {string} scheme - The scheme name for the XML representation URL
 * @param {string} version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number)
 * @returns {Promise<string[]>} A promise that resolves to an array of metadata strings
 * @throws {Error} If there's an HTTP error or if the SPARQL request fails
 *
 * @example
 * // Example usage for published version:
 * try {
 *   const metadata = await getCsvMetadata('sciencekeywords', 'published');
 *   console.log(metadata);
 * } catch (error) {
 *   console.error('Error generating metadata:', error);
 * }
 *
 * // Example output:
 * // [
 * //   'Keyword Version: N',
 * //   'Revision: 2023-06-15',
 * //   'Timestamp: 2023-06-20 14:30:45',
 * //   'Terms Of Use: https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
 * //   'The most up to date XML representations can be found here: https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords/?format=xml'
 * // ]
 *
 * @example
 * // Example usage for draft version:
 * try {
 *   const metadata = await getCsvMetadata('instruments', 'draft');
 *   console.log(metadata);
 * } catch (error) {
 *   console.error('Error generating metadata:', error);
 * }
 *
 * @example
 * // Error handling for an invalid scheme:
 * try {
 *   const metadata = await getCsvMetadata('invalidscheme', 'published');
 * } catch (error) {
 *   console.error('Error generating metadata:', error);
 * }
 *
 * @see Related functions:
 * {@link getConceptSchemeDetailsQuery}
 * {@link sparqlRequest}
 */
export const getCsvMetadata = async (scheme, version) => {
  if (scheme.toLowerCase() === 'granuledataformat') {
    // eslint-disable-next-line no-param-reassign
    scheme = 'dataformat'
  }

  let updateDate = 'N/A'
  try {
    // Make a SPARQL request to fetch concept scheme details
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptSchemeDetailsQuery(scheme),
      version
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
