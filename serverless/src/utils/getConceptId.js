import { XMLParser } from 'fast-xml-parser'

/**
 * Extracts the concept ID from the RDF/XML data.
 *
 * @param {string} rdfXml - The RDF/XML representation of the concept.
 * @returns {string|null} The extracted concept ID or null if not found.
 * @throws {Error} If the XML is invalid, doesn't contain a skos:Concept element, or contains multiple concepts.
 */
const getConceptId = (rdfXml) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    isArray: (name) => name === 'skos:Concept'
  })

  try {
    const result = parser.parse(rdfXml)
    const concepts = result['rdf:RDF']['skos:Concept']

    if (!concepts || concepts.length === 0) {
      throw new Error('Invalid XML: skos:Concept element not found')
    }

    if (concepts.length > 1) {
      throw new Error('Multiple skos:Concept elements found. Only one concept is allowed.')
    }

    const concept = concepts[0]
    const aboutAttr = concept['@_rdf:about']
    if (!aboutAttr) {
      throw new Error('rdf:about attribute not found in skos:Concept element')
    }

    // Extract the concept ID using split and pop
    const conceptId = aboutAttr.split('/').pop()

    return conceptId || null
  } catch (error) {
    throw new Error(`Error extracting concept ID: ${error.message}`)
  }
}

export default getConceptId
