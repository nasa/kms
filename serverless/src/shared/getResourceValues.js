import { XMLParser } from 'fast-xml-parser'

/**
 * Extracts resource values (UUIDs) from RDF/XML for a given element name.
 *
 * @param {string} rdfXml - The RDF/XML content to parse.
 * @param {string} elementName - The name of the element to extract values from.
 * @returns {string[]} An array of resource UUIDs.
 *
 * @example
 * const rdfXml = `
 *   <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#">
 *     <skos:Concept>
 *       <skos:broader rdf:resource="1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p"/>
 *       <skos:broader rdf:resource="2b3c4d5e-6f7g-8h9i-0j1k-2l3m4n5o6p7q"/>
 *       <skos:related rdf:resource="3c4d5e6f-7g8h-9i0j-1k2l-3m4n5o6p7q8r"/>
 *     </skos:Concept>
 *   </rdf:RDF>
 * `;
 *
 * const broaderConcepts = getResourceValues(rdfXml, 'skos:broader');
 * console.log(broaderConcepts);
 * // Output: ['1a2b3c4d-5e6f-7g8h-9i0j-1k2l3m4n5o6p', '2b3c4d5e-6f7g-8h9i-0j1k-2l3m4n5o6p7q']
 *
 * const relatedConcepts = getResourceValues(rdfXml, 'skos:related');
 * console.log(relatedConcepts);
 * // Output: ['3c4d5e6f-7g8h-9i0j-1k2l-3m4n5o6p7q8r']
 */
export const getResourceValues = (rdfXml, elementName) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: true
  })

  try {
    const result = parser.parse(rdfXml)
    const concept = result['rdf:RDF']['skos:Concept']

    if (!concept) {
      console.warn('No skos:Concept element found')

      return []
    }

    const element = concept[elementName]

    if (!element) {
      return []
    }

    // Handle array of elements
    if (Array.isArray(element)) {
      return element.map((e) => e['@_rdf:resource']).filter(Boolean)
    }

    // Handle single element (object with @_rdf:resource)
    if (typeof element === 'object' && '@_rdf:resource' in element) {
      return [element['@_rdf:resource']]
    }

    return []
  } catch (error) {
    console.error(`Error parsing RDF/XML: ${error.message}`)

    return []
  }
}
