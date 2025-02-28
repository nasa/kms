import {
  getConceptPrefLabelAndBroaderIdQuery
} from '@/shared/operations/queries/getConceptPrefLabelAndBroaderIdQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

/**
 * Builds a full hierarchical path string for a given SKOS concept.
 *
 * This function takes a concept identifier and constructs a string representing
 * the full hierarchical path from the root concept to the given concept,
 * using the SKOS broader relationship.
 *
 * @async
 * @function buildPath
 * @param {string} conceptId - The identifier of the SKOS concept.
 * @returns {Promise<string>} A promise that resolves to the full path string.
 *                            Path elements are separated by '|' characters.
 * @throws {Error} Throws an error if there's an HTTP error during SPARQL requests.
 *
 * @example
 * // Returns a promise that resolves to "EARTH SCIENCE|ATMOSPHERE|AEROSOLS"
 * buildPath('e610b940-2fda-4e1f-88eb-1b2b7bd23e7d')
 *
 * @see {@link https://www.w3.org/2004/02/skos/|SKOS Specification}
 * @see {@link https://cmr.sit.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords|GCMD Science Keywords}
 */
export const buildFullPath = async (conceptId) => {
  const baseUri = 'https://gcmd.earthdata.nasa.gov/kms/concept/'

  const fetchConceptInfo = async (uri) => {
    const response = await sparqlRequest({
      method: 'POST',
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      body: getConceptPrefLabelAndBroaderIdQuery(uri)
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()
    const triples = json.results.bindings

    if (triples.length === 0) {
      return null
    }

    return {
      prefLabel: triples[0].prefLabel.value,
      broader: triples[0].broader.value
    }
  }

  const buildPathRecursive = async (uri) => {
    const conceptInfo = await fetchConceptInfo(uri)

    if (!conceptInfo) {
      return []
    }

    const parentPath = await buildPathRecursive(conceptInfo.broader)

    return [...parentPath, conceptInfo.prefLabel]
  }

  const path = await buildPathRecursive(`${baseUri}${conceptId}`)

  return path.join('|')
}
