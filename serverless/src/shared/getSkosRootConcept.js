import {
  getTriplesForRootConceptQuery
} from '@/shared/operations/queries/getTriplesForRootConceptQuery'
import { sparqlRequest } from '@/shared/sparqlRequest'

import { toSkosJson } from './toSkosJson'

export const getSkosRootConcept = async (schemeId, version) => {
  try {
    const response = await sparqlRequest({
      contentType: 'application/sparql-query',
      accept: 'application/sparql-results+json',
      method: 'POST',
      body: getTriplesForRootConceptQuery(schemeId),
      version
    })
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`)
    }

    const json = await response.json()

    if (json.results.bindings.length === 0) {
      return null
    }

    // Get the subject (s) value from the first binding
    const conceptIRI = json.results.bindings[0].s.value

    return toSkosJson(conceptIRI, json.results.bindings)
  } catch (error) {
    console.error('Error fetching SKOS root concept:', error)
    throw error
  }
}
