import { XMLParser } from 'fast-xml-parser'

/**
 * Validates that the skos:notation matches the last part of the rdf:about attribute
 * in the skos:ConceptScheme element of the provided RDF XML.
 *
 * @param {string} schemeRdf - The RDF XML string to validate.
 * @returns {boolean} Returns true if the validation passes.
 * @throws {Error} Throws an error if validation fails or required elements are missing.
 *
 * @example
 * import { validateSchemeNotation } from './validateSchemeNotation';
 *
 * const schemeRdf = `
 * <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"
 *          xmlns:skos="http://www.w3.org/2004/02/skos/core#">
 *   <skos:ConceptScheme rdf:about="https://example.com/scheme/a12">
 *     <skos:notation>a12</skos:notation>
 *   </skos:ConceptScheme>
 * </rdf:RDF>
 * `;
 *
 * try {
 *   const isValid = validateSchemeNotation(schemeRdf);
 *   console.log("Scheme notation is valid");
 * } catch (error) {
 *   console.error("Validation failed:", error.message);
 * }
 */
export const validateSchemeNotation = (schemeRdf) => {
  // Configure and create the parser
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: true
  })

  // Parse the RDF XML
  const result = parser.parse(schemeRdf)

  // Navigate to the skos:ConceptScheme element
  const conceptScheme = result['rdf:RDF']['skos:ConceptScheme']
  if (!conceptScheme) {
    throw new Error('skos:ConceptScheme element not found')
  }

  // Get the rdf:about attribute value
  const about = conceptScheme['@_rdf:about']
  if (!about) {
    throw new Error('rdf:about attribute not found on skos:ConceptScheme')
  }

  // Extract the last part of the rdf:about URL
  const schemeId = about.split('/').pop()

  // Get the skos:notation value
  const notation = conceptScheme['skos:notation']
  if (!notation) {
    throw new Error('skos:notation element not found')
  }

  // Compare schemeId with notation
  if (schemeId !== notation) {
    throw new Error(`Mismatch: rdf:about (${schemeId}) does not match skos:notation (${notation})`)
  }

  return true
}
