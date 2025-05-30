import { XMLParser } from 'fast-xml-parser'

/**
 * Extracts the scheme ID and prefLabel from an RDF/XML string.
 *
 * This function parses the provided RDF/XML string and extracts the scheme ID
 * from the skos:ConceptScheme element's rdf:about attribute and the prefLabel
 * from the skos:prefLabel element.
 *
 * @param {string} rdfXml - The RDF/XML string to parse.
 * @returns {{schemeId: string|null, schemePrefLabel: string|null}} An object containing the extracted scheme ID and prefLabel.
 * @throws {Error} If the XML is invalid or doesn't contain the expected structure.
 *
 * @example
 * const rdfXml = `
 * <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns:skos="http://www.w3.org/2004/02/skos/core#" xmlns:gcmd="https://gcmd.earthdata.nasa.gov/kms#" xmlns:dcterms="http://purl.org/dc/terms/">
 *   <skos:ConceptScheme rdf:about="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/sciencekeywords">
 *     <skos:prefLabel>Science Keywords</skos:prefLabel>
 *     <skos:notation>sciencekeywords</skos:notation>
 *     <dcterms:modified>2025-03-31</dcterms:modified>
 *     <gcmd:csvHeaders>Category,Topic,Term,Variable_Level_1,Variable_Level_2,Variable_Level_3,Detailed_Variable,UUID</gcmd:csvHeaders>
 *   </skos:ConceptScheme>
 * </rdf:RDF>
 * `;
 *
 * try {
 *   const { schemeId, schemePrefLabel } = getSchemeInfo(rdfXml);
 *   console.log(schemeId); // Output: "sciencekeywords"
 *   console.log(schemePrefLabel); // Output: "Science Keywords"
 * } catch (error) {
 *   console.error(error.message);
 * }
 */
export const getSchemeInfo = (rdfXml) => {
  // Configure XML parser options
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    isArray: (name) => name === 'skos:ConceptScheme'
  })

  try {
    // Parse the XML string
    const result = parser.parse(rdfXml)
    // Extract the ConceptScheme elements
    const schemes = result['rdf:RDF']['skos:ConceptScheme']

    // Check if ConceptScheme exists
    if (!schemes || schemes.length === 0) {
      throw new Error('Invalid XML: skos:ConceptScheme element not found')
    }

    // Ensure only one ConceptScheme is present
    if (schemes.length > 1) {
      throw new Error('Multiple skos:ConceptScheme elements found. Only one ConceptScheme is allowed.')
    }

    // Get the first (and only) ConceptScheme
    const scheme = schemes[0]
    // Extract the rdf:about attribute
    const aboutAttr = scheme['@_rdf:about']
    if (aboutAttr === undefined) {
      throw new Error('rdf:about attribute not found in skos:ConceptScheme element')
    }

    // Extract the scheme ID using split and pop
    const schemeId = aboutAttr.split('/').pop() || null

    // Extract the prefLabel
    const schemePrefLabel = scheme['skos:prefLabel'] || null

    // Return an object with schemeId and schemePrefLabel
    return {
      schemeId,
      schemePrefLabel
    }
  } catch (error) {
    // Wrap and rethrow any errors
    throw new Error(`Error extracting scheme information: ${error.message}`)
  }
}
