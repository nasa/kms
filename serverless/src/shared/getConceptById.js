import { XMLBuilder } from 'fast-xml-parser'

import { namespaces } from '@/shared/constants/namespaces'
import { getGcmdMetadata } from '@/shared/getGcmdMetadata'
import { getSkosConcept } from '@/shared/getSkosConcept'

/**
 * Retrieves a SKOS Concept by its ID and returns it as RDF/XML.
 *
 * @async
 * @function getConceptById
 * @param {string} conceptId - The ID of the concept to retrieve.
 * @param {string} [version='published'] - The version of the concept to retrieve (default is 'published').
 * @returns {Promise<string|null>} A promise that resolves to the RDF/XML string representation of the concept, or null if not found.
 *
 * @example
 * const conceptRdfXml = await getConceptById('123', 'draft');
 * if (conceptRdfXml) {
 *   console.log(conceptRdfXml);
 * } else {
 *   console.log('Concept not found');
 * }
 *
 * @throws {Error} If there's an error retrieving or processing the concept.
 */
export const getConceptById = async (conceptId, version = 'published') => {
  try {
    const conceptIRI = `https://gcmd.earthdata.nasa.gov/kms/concept/${conceptId}`

    const concept = await getSkosConcept({
      conceptIRI,
      version
    })

    if (concept === null) {
      return null
    }

    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      indentBy: '  ',
      attributeNamePrefix: '@',
      suppressEmptyNode: true,
      textNodeName: '_text'
    })

    const rdfJson = {
      'rdf:RDF': {
        ...namespaces,
        '@xml:base': 'https://gcmd.earthdata.nasa.gov/kms/concept/',
        'gcmd:gcmd': await getGcmdMetadata({
          conceptIRI,
          version
        }),
        'skos:Concept': [concept]
      }
    }

    return builder.build(rdfJson)
  } catch (error) {
    console.error(`Error retrieving concept by ID, error=${error.toString()}`)
    throw error
  }
}

export default getConceptById
