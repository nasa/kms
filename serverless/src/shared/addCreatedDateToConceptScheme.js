import { XMLBuilder, XMLParser } from 'fast-xml-parser'

/**
 * Adds a creation date to a skos:ConceptScheme in RDF/XML if it doesn't already exist.
 *
 * This function parses the input RDF/XML, checks for the presence of a dcterms:created
 * element within the skos:ConceptScheme, and adds one with the current date if it's not found.
 *
 * @param {string} rdfXml - The input RDF/XML string.
 * @returns {string} The modified RDF/XML string with added creation date, or the original if no changes were made.
 *
 * @example
 * const inputRdf = `
 * <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
 *          xmlns:skos="http://www.w3.org/2004/02/skos/core#"
 *          xmlns:dcterms="http://purl.org/dc/terms/">
 *   <skos:ConceptScheme rdf:about="http://example.com/scheme">
 *     <skos:prefLabel>Example Scheme</skos:prefLabel>
 *   </skos:ConceptScheme>
 * </rdf:RDF>
 * `;
 *
 * const updatedRdf = addCreatedDateToConceptScheme(inputRdf);
 * console.log(updatedRdf);
 * // Output will include a new <dcterms:created> element with current date
 */
export const addCreatedDateToConceptScheme = (rdfXml) => {
  try {
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
      allowBooleanAttributes: true,
      preserveOrder: true,
      parseAttributeValue: false,
      trimValues: false
    })
    const xmlObj = parser.parse(rdfXml)

    // Find the rdf:RDF element
    const rdfElement = xmlObj.find((el) => el['rdf:RDF'])
    if (rdfElement && rdfElement['rdf:RDF']) {
      // Find the skos:ConceptScheme element
      const conceptSchemeElement = rdfElement['rdf:RDF'].find((el) => el['skos:ConceptScheme'])
      if (conceptSchemeElement && conceptSchemeElement['skos:ConceptScheme']) {
        const conceptScheme = conceptSchemeElement['skos:ConceptScheme']

        // Check if dcterms:created already exists
        if (!conceptScheme.some((el) => el['dcterms:created'])) {
          const currentDate = new Date().toISOString().split('T')[0]
          // Add the dcterms:created element
          conceptScheme.push({ 'dcterms:created': [{ '#text': currentDate }] })

          const builder = new XMLBuilder({
            ignoreAttributes: false,
            attributeNamePrefix: '@_',
            format: true,
            preserveOrder: true,
            suppressEmptyNode: true
          })

          return builder.build(xmlObj)
        }
      }
    }

    return rdfXml
  } catch (error) {
    console.error('Error processing RDF/XML:', error)

    return rdfXml
  }
}
