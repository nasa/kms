import { XMLBuilder } from 'fast-xml-parser'
import { v4 as uuidv4 } from 'uuid'

/**
 * Creates an RDF (Resource Description Framework) representation of a root concept.
 *
 * @param {string} schemeId - The unique identifier for the concept scheme.
 * @param {string} schemePrefLabel - The preferred label for the concept scheme.
 * @returns {string} The RDF representation of the root concept as an XML string.
 *
 * @example
 * const schemeId = 'science_keywords';
 * const schemePrefLabel = 'Earth Science Keywords';
 * const rdfXml = createRootConceptRdf(schemeId, schemePrefLabel);
 * console.log(rdfXml);
 * // Output will be an XML string representing the RDF of the root concept, similar to:
 * // <?xml version="1.0" encoding="UTF-8"?>
 * // <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
 * //          xmlns:skos="http://www.w3.org/2004/02/skos/core#"
 * //          xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#"
 * //          xmlns:dcterms="http://purl.org/dc/terms/">
 * //   <skos:Concept rdf:about="550e8400-e29b-41d4-a716-446655440000">
 * //     <skos:prefLabel xml:lang="en">Earth Science Keywords</skos:prefLabel>
 * //     <skos:inScheme rdf:resource="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/science_keywords"/>
 * //   </skos:Concept>
 * // </rdf:RDF>
 */
export const createRootConceptRdf = (schemeId, schemePrefLabel) => {
  // Generate a unique identifier for the concept
  const uuid = uuidv4()
  // Configuration options for XML builder
  const options = {
    ignoreAttributes: false,
    format: true,
    suppressBooleanAttributes: false,
    attributeNamePrefix: '@_'
  }
  // Create a new XML builder instance
  const builder = new XMLBuilder(options)
  // Define the RDF object structure
  const obj = {
    'rdf:RDF': {
      '@_xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      '@_xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
      '@_xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
      '@_xmlns:dcterms': 'http://purl.org/dc/terms/',
      'skos:Concept': {
        '@_rdf:about': uuid,
        'skos:prefLabel': {
          '@_xml:lang': 'en',
          '#text': schemePrefLabel
        },
        'skos:inScheme': {
          '@_rdf:resource': `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${schemeId}`
        }
      }
    }
  }

  // Build and return the XML string
  return builder.build(obj)
}
