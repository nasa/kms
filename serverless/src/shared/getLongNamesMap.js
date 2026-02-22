// Import necessary functions and modules
import { getLongNamesQuery } from '@/shared/operations/queries/getLongNamesQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Fetches long names for a given scheme and version, returning them as a map
 * @async
 * @function getLongNamesMap
 * @param {string} scheme - The scheme to fetch long names for
 * @param {string} version - The version of the concept scheme to query (e.g., 'published', 'draft', or a specific version number)
 * @returns {Promise<Object>} A map of subject values to their associated long name
 * @throws {Error} If there's an HTTP error or if the SPARQL request fails
 *
 * @example
 * // Fetch long names for the 'platforms' scheme in the published version
 * try {
 *   const longNamesMap = await getLongNamesMap('platforms', 'published');
 *   console.log(longNamesMap);
 *   // Example output:
 *   // {
 *   //   'https://gcmd.earthdata.nasa.gov/kms/concept/d77685bd-aa94-4717-bd97-632699d999b5': 'Dassault HU-25A Guardian',
 *   //   'https://gcmd.earthdata.nasa.gov/kms/concept/ba1d0da3-7f0b-4390-833f-67708525f1a3': 'Long EZ Aircraft',
 *   //   'https://gcmd.earthdata.nasa.gov/kms/concept/879d697c-381f-45df-a48d-2d9095bc5c54': 'NSF/NCAR Gulfstream GV Aircraft'
 *   // }
 * } catch (error) {
 *   console.error('Failed to fetch platform long names:', error);
 * }
 *
 * @example
 * // Fetch long names for the 'organization' scheme in the draft version
 * try {
 *   const orgLongNames = await getLongNamesMap('organization', 'draft');
 *   console.log(orgLongNames);
 * } catch (error) {
 *   console.error('Failed to fetch organization long names:', error);
 * }
 *
 * @see Related functions:
 * {@link getLongNamesQuery}
 * {@link sparqlRequest}
 */
export const getLongNamesMap = async (scheme, version) => {
  try {
    // Make a SPARQL request to fetch long names
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getLongNamesQuery(scheme),
      version,
      timeoutMs: Number.parseInt(process.env.CONCEPTS_READ_TIMEOUT_MS || '30000', 10)
    })

    // Check if the response is successful
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    // Parse the JSON response
    const json = await response.json()

    // Extract the triples from the response
    const triples = json.results.bindings

    // Initialize an empty map to store the results
    const map = {}

    // Iterate through each triple in the results
    triples.forEach((triple) => {
      map[triple.subject.value] = triple.longName.value
    })

    // Return the completed map
    return map
  } catch (error) {
    // Log any errors that occur during the process
    console.error('Error fetching triples:', error)
    // Re-throw the error for handling by the caller
    throw error
  }
}
