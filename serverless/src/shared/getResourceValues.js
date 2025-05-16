import { XMLParser } from 'fast-xml-parser'

/**
 * Extracts all 'rdf:resource' values for a given element name from the RDF/XML data.
 *
 * @param {string} rdfXml - The RDF/XML representation of the concept.
 * @param {string} elementName - The name of the element to search for (e.g., 'skos:related').
 * @returns {string[]} An array of 'rdf:resource' values.
 * @throws {Error} If the XML is invalid or doesn't contain a skos:Concept element.
 */
export const getResourceValues = (rdfXml, elementName) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    isArray: (name) => name === 'skos:Concept' || name === elementName
  })

  try {
    const result = parser.parse(rdfXml)
    const concept = result['rdf:RDF']['skos:Concept']

    if (!concept || concept.length === 0) {
      throw new Error('Invalid XML: skos:Concept element not found')
    }

    const elements = concept[0][elementName]

    if (!elements) {
      return []
    }

    if (Array.isArray(elements)) {
      return elements.map((element) => element['@_rdf:resource']).filter(Boolean)
    }

    return elements['@_rdf:resource'] ? [elements['@_rdf:resource']] : []
  } catch (error) {
    throw new Error(`Error extracting resource values: ${error.message}`)
  }
}
