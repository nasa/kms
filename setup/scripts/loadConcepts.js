/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-promise-executor-return */

import { readFileSync } from 'fs'

import { XMLBuilder, XMLParser } from 'fast-xml-parser'

import { delay } from '../../serverless/src/shared/delay'

const KMS_ENDPOINT = 'https://cmr.sit.earthdata.nasa.gov'

/**
 * Loads SKOS concepts and schemes into a KMS endpoint for specified versions.
 *
 * This function performs the following operations:
 * 1. Recreates the database at the KMS endpoint.
 * 2. For each version type ('published' and 'draft'):
 *    a. Loads concepts from the corresponding RDF file into the SPARQL endpoint.
 *    b. Loads schemes from the corresponding RDF file into the SPARQL endpoint.
 *
 * The function uses batch processing for loading concepts to manage large datasets efficiently.
 *
 * @async
 * @function loadConcepts
 * @param {string} token - Authentication token for API requests.
 * @throws {Error} If there's an issue recreating the database, loading concepts, or loading schemes.
 *
 * @example
 * loadConcepts('your-auth-token-here');
 *
 * @requires fs
 * @requires fast-xml-parser
 * @requires ../../serverless/src/shared/delay
 *
 * File naming convention:
 * - For concepts: concepts_{version}.rdf
 * - For schemes: schemes_{version}.rdf
 *
 * The function uses the KMS_ENDPOINT constant (default: 'https://cmr.sit.earthdata.nasa.gov')
 * to determine the target SPARQL endpoint.
 *
 * Internal functions:
 * - loadConceptsForVersion: Loads concepts for a specific version in batches.
 * - loadSchemes: Loads schemes for a specific version.
 * - recreateDatabase: Recreates the database at the KMS endpoint.
 *
 * @note This function assumes that RDF files for concepts and schemes are present in the '../data/' directory.
 * @note It uses a 500ms delay between batch loads to prevent overwhelming the server.
 */

const loadConcepts = async (token) => {
  /**
   * Loads SKOS concepts from an RDF/XML file into a KMS endpoint in batches.
   */
  async function loadConceptsForVersion(version, batchSize = 1000) {
    // Read the XML file
    const filePath = `../data/concepts_${version}.rdf`

    const xmlData = readFileSync(filePath, 'utf8')

    // Configure the parser
    const options = {
      format: true,
      ignoreAttributes: false,
      indentBy: '  ',
      attributeNamePrefix: '@',
      suppressEmptyNode: true,
      textNodeName: '_text',
      parseAttributeValue: true
    }

    // Parse the XML
    const parser = new XMLParser(options)
    const result = parser.parse(xmlData)

    // Get the array of skos:Concept elements
    const concepts = result['rdf:RDF']['skos:Concept']

    const builder = new XMLBuilder({
      format: true,
      ignoreAttributes: false,
      indentBy: '  ',
      attributeNamePrefix: '@',
      suppressEmptyNode: true,
      textNodeName: '_text'
    })

    for (let i = 0; i < concepts.length; i += 1) {
      const concept = concepts[i]
      delete concept['@xmlns:rdf']
      delete concept['@xmlns:skos']
      delete concept['@xmlns:gcmd']
      delete concept['@xmlns:dcterms']
    }

    for (let i = 0; i < concepts.length; i += batchSize) {
      const batch = concepts.slice(i, i + batchSize)
      const rdfJson = {
        'rdf:RDF': {
          '@xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
          '@xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
          '@xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
          '@xmlns:dcterms': 'http://purl.org/dc/terms/',
          'skos:Concept': batch
        }
      }

      const xml = builder.build(rdfJson)

      console.log(`Loading batch ${i / batchSize + 1}, concepts ${i + 1}-${Math.min(i + batchSize, concepts.length)}`)
      const response = await fetch(`${KMS_ENDPOINT}/kms/concepts?version=${version}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/rdf+xml',
          Accept: 'application/rdf+xml',
          Authorization: token
        },
        body: xml
      })

      if (!response.ok) {
        console.error(`Error loading batch ${i / batchSize + 1}:`, response.statusText)
      }

      console.log('Success: ', await response.text())

      // Add a delay of 500 ms between each batch
      await delay(500)
    }
  }

  async function loadSchemes(version) {
  // Read the XML file
    const filePath = `../data/schemes_${version}.rdf`

    const xmlData = readFileSync(filePath, 'utf8')

    const response = await fetch(`${KMS_ENDPOINT}/kms/concepts?version=${version}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/rdf+xml',
        Accept: 'application/rdf+xml',
        Authorization: token
      },
      body: xmlData
    })

    if (!response.ok) {
      console.error('Error loading schemes.rdf')
    }

    console.log('Success: ', await response.text())
  }

  async function recreateDatabase() {
    const response = await fetch(`${KMS_ENDPOINT}/kms/recreateDatabase`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/rdf+xml',
        Accept: 'application/rdf+xml',
        Authorization: token
      }
    })

    if (!response.ok) {
      console.error('Error recreating database')
    }

    console.log('Success: ', await response.text())
  }

  try {
    await recreateDatabase(token)
    const versions = ['published', 'draft']
    for (const version of versions) {
      try {
        await loadConceptsForVersion(token, version)
        console.log('All concepts loaded successfully ', version)
        await loadSchemes(token, version)
        console.log('All schemes loaded successfully', version)
      } catch (error) {
        console.error('Error loading concepts:', error)
      }
    }
  } catch (error) {
    console.error('Conversion failed:', error)
    process.exit(1)
  }
}

const token = process.argv[2]

if (!token) {
  console.error('Please provide an authentication token as the first argument')
  console.error('Usage: npx vite-node loadConcepts.js <YOUR_TOKEN>')
  process.exit(1)
}

loadConcepts(token)
