/**
 * Ensures that the given RDF/XML includes a skos:inScheme element for the specified scheme.
 *
 * This function checks if the RDF/XML already contains a skos:inScheme element.
 * If not, it inserts a new skos:inScheme element just before the closing </skos:Concept> tag.
 *
 * @param {string} rdfXml - The RDF/XML string to process.
 * @param {string} scheme - The scheme to be included in the skos:inScheme element.
 * @returns {string} The processed RDF/XML string with the skos:inScheme element included.
 * @throws {Error} If the RDF/XML is invalid (missing </skos:Concept> closing tag).
 *
 * @example
 * const originalRdfXml = `
 *   <rdf:RDF>
 *     <skos:Concept>
 *       <skos:prefLabel>Example Concept</skos:prefLabel>
 *     </skos:Concept>
 *   </rdf:RDF>
 * `;
 *
 * const updatedRdfXml = ensureInScheme(originalRdfXml, 'exampleScheme');
 *
 * console.log(updatedRdfXml);
 * // Output:
 * // <rdf:RDF>
 * //   <skos:Concept>
 * //     <skos:prefLabel>Example Concept</skos:prefLabel>
 * //     <skos:inScheme rdf:resource="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/exampleScheme"/>
 * //   </skos:Concept>
 * // </rdf:RDF>
 */
export const ensureInScheme = (rdfXml, scheme) => {
  // Check if skos:inScheme is already present
  if (rdfXml.includes('<skos:inScheme')) {
    return rdfXml // Return original rdfXml if skos:inScheme is already present
  }

  // Find the position to insert the new element
  const insertPosition = rdfXml.lastIndexOf('</skos:Concept>')

  if (insertPosition === -1) {
    throw new Error('Invalid RDF/XML: Missing </skos:Concept> closing tag')
  }

  // Create the new skos:inScheme element
  const inSchemeElement = `<skos:inScheme rdf:resource="https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme}"/>`

  // Insert the new element
  return rdfXml.slice(0, insertPosition) + inSchemeElement + rdfXml.slice(insertPosition)
}
