import {
  getConceptIdAndPrefLabelQuery
} from '@/shared/operations/queries/getConceptIdAndPrefLabelQuery'

import { sparqlRequest } from './sparqlRequest'

/**
 * Fetches all SKOS concept preferred labels and returns a map of identifiers to labels.
 *
 * @async
 * @function createPrefLabelMap
 * @returns {Promise<Map<string, string>>} A promise that resolves to a Map where keys are SKOS concept identifiers and values are their preferred labels.
 * @throws Will throw an error if the SPARQL request or parsing fails.
 *
 * @example
 * try {
 *   const prefLabelMap = await createPrefLabelMap();
 *   console.log('Preferred label for concept 123:', prefLabelMap.get('123'));
 *   console.log('Total number of concepts:', prefLabelMap.size);
 * } catch (error) {
 *   console.error('Failed to create preferred label map:', error);
 * }
 */
export const createPrefLabelMap = async (version) => {
  try {
    const response = await sparqlRequest({
      method: 'POST',
      body: getConceptIdAndPrefLabelQuery(),
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      version
    })

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const data = await response.json()
    const prefLabelMap = new Map()

    data.results.bindings.forEach((binding) => {
      const fullConceptUri = binding.concept.value
      const conceptId = fullConceptUri.split('/').pop()
      const prefLabel = binding.prefLabel.value
      prefLabelMap.set(conceptId, prefLabel)
    })

    return prefLabelMap
  } catch (error) {
    console.error('Error fetching SKOS preferred labels:', error)
    throw error
  }
}
