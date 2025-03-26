import { sparqlRequest } from '@/shared/sparqlRequest'

const { XMLParser, XMLBuilder } = require('fast-xml-parser')

/**
 * Creates and uploads RDF schemes for a specific version of GCMD keywords.
 *
 * This function fetches concept schemes from a specified URL, processes them,
 * creates an RDF structure, and uploads it to a SPARQL endpoint.
 *
 * @async
 * @function createSchemes
 * @param {string} versionType - The type of version (e.g., 'published', 'draft').
 * @param {string} version - The version number or identifier.
 * @returns {Promise<Object>} A promise that resolves to the response from the SPARQL endpoint.
 * @throws {Error} If there's an error fetching, parsing, or uploading the schemes.
 *
 * @example
 * try {
 *   const response = await createSchemes('draft', '1.0');
 *   console.log('Schemes created and uploaded successfully:', response);
 * } catch (error) {
 *   console.error('Error creating schemes:', error);
 * }
 */
export const createSchemes = async (versionType, version) => {
  let url = 'http://gcmd.earthdata.nasa.gov/kms/concept_schemes'
  if (version && version !== 'published') {
    url += `?version=${version}`
  }

  const response = await fetch(url)
  const inputXml = await response.text()
  // Parse the input XML
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_'
  })
  const parsedJson = parser.parse(inputXml)

  // Find the most recent update date
  const mostRecentDate = parsedJson.schemes.scheme.reduce((maxDate, scheme) => {
    const schemeDate = new Date(scheme['@_updateDate'])

    return schemeDate > maxDate ? schemeDate : maxDate
  }, new Date(0))

  // Prepare the RDF structure
  const rdfObject = {
    'rdf:RDF': {
      '@_xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
      '@_xmlns:rdfs': 'http://www.w3.org/2000/01/rdf-schema#',
      '@_xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
      '@_xmlns:dcterms': 'http://purl.org/dc/terms/',
      '@_xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
      'gcmd:Version': {
        '@_rdf:about': 'https://gcmd.earthdata.nasa.gov/kms/version_metadata',
        'gcmd:versionName': version,
        'gcmd:versionType': versionType,
        'dcterms:modified': mostRecentDate.toISOString(),
        'dcterms:created': mostRecentDate.toISOString()
      },
      'skos:ConceptScheme': []
    }
  }

  // Process each scheme
  parsedJson.schemes.scheme.forEach((scheme) => {
    const conceptScheme = {
      '@_rdf:about': `https://gcmd.earthdata.nasa.gov/kms/concepts/concept_scheme/${scheme['@_name']}`,
      'skos:prefLabel': {
        '@_xml:lang': 'en',
        '#text': scheme['@_longName']
      },
      'skos:notation': scheme['@_name'],
      'dcterms:modified': {
        '@_rdf:datatype': 'http://www.w3.org/2001/XMLSchema#date',
        '#text': scheme['@_updateDate']
      }
    }

    if (scheme['@_csvHeaders']) {
      conceptScheme['gcmd:csvHeaders'] = scheme['@_csvHeaders']
    }

    rdfObject['rdf:RDF']['skos:ConceptScheme'].push(conceptScheme)
  })

  // Create the XML builder
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    format: true,
    indentBy: '  ',
    attributeNamePrefix: '@_'
  })

  // Build the final XML
  const xml = builder.build(rdfObject)

  return sparqlRequest({
    contentType: 'application/rdf+xml',
    accept: 'application/rdf+xml',
    path: '/statements',
    method: 'POST',
    body: xml,
    version
  })
}
