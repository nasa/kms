import { getSkosConcept } from './getSkosConcept'

/**
 * Creates a map of concept IRIs to their corresponding preferred labels.
 *
 * This function takes an array of concept objects, fetches the full SKOS concept for each,
 * and creates a Map where the keys are the concept IRIs and the values are their preferred labels.
 * It handles both full IRIs and partial IRIs, prepending a base URI when necessary.
 *
 * @async
 * @function createPrefLabelMap
 * @param {Array<{conceptIRI: string}>} concepts - An array of objects, each containing a conceptIRI property.
 * @param {string} [baseURI='https://gcmd.earthdata.nasa.gov/kms/concept/'] - The base URI to prepend to partial IRIs.
 * @returns {Promise<Map<string, string>>} A promise that resolves to a Map where:
 *   - key: The full concept IRI (string)
 *   - value: The preferred label of the concept (string)
 * @throws {Error} If there's an error creating the prefLabel map.
 *
 * @example
 * const concepts = [
 *   { conceptIRI: 'http://example.com/concept/1' },
 *   { conceptIRI: '2' }, // Partial IRI
 * ];
 *
 * try {
 *   const prefLabelMap = await createPrefLabelMap(concepts);
 *   console.log('PrefLabel Map:', prefLabelMap);
 *   // Example output:
 *   // PrefLabel Map: Map(2) {
 *   //   'http://example.com/concept/1' => 'Concept One',
 *   //   'https://gcmd.earthdata.nasa.gov/kms/concept/2' => 'Concept Two'
 *   // }
 * } catch (error) {
 *   console.error('Error creating prefLabel map:', error);
 * }
 */

function createPrefLabelMap(concepts, baseURI = 'https://gcmd.earthdata.nasa.gov/kms/concept/') {
  return Promise.all(
    concepts.map((concept) => {
      let fullConceptIRI = concept.conceptIRI
      if (!fullConceptIRI.startsWith('http')) {
        fullConceptIRI = `${baseURI}${concept.conceptIRI}`
      }

      return getSkosConcept({ conceptIRI: fullConceptIRI })
        .then((skosConcept) => {
          if (!skosConcept || !skosConcept['@rdf:about'] || !skosConcept['skos:prefLabel']) {
            console.warn(`Invalid skosConcept for conceptIRI: ${fullConceptIRI}`, skosConcept)

            return null
          }

          return [
            skosConcept['@rdf:about'],
            // eslint-disable-next-line no-underscore-dangle
            skosConcept['skos:prefLabel']._text
          ]
        })
        .catch((error) => {
          console.error(`Error fetching concept for conceptIRI: ${fullConceptIRI}`, error)

          return null
        })
    })
  )
    .then((entries) => new Map(entries.filter(Boolean)))
    .catch((error) => {
      console.error('Error creating prefLabel map:', error)
      throw error
    })
}

export { createPrefLabelMap }
