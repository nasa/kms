/* eslint-disable no-restricted-syntax */
/* eslint-disable no-await-in-loop */
/* eslint-disable no-promise-executor-return */

const fs = require('fs')

const { XMLParser, XMLBuilder } = require('fast-xml-parser')

const { fetchVersions } = require('./fetchVersions')

/**
 * Creates a delay of the specified milliseconds.
 *
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise} A promise that resolves after the specified delay.
 */
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * Loads SKOS concepts from an RDF/XML file into a SPARQL endpoint in batches.
 *
 * @async
 * @param {string} filePath - The path to the RDF/XML file containing the concepts.
 * @param {number} [batchSize=100] - The number of concepts to send in each batch.
 */
async function loadConcepts(versionType, version, batchSize = 1000) {
  // Read the XML file
  let filePath = `../data/concepts_${version}.rdf`
  if (versionType === 'published') {
    filePath = '../data/concepts_published.rdf\''
  }

  const xmlData = fs.readFileSync(filePath, 'utf8')

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
    const response = await fetch('https://cmr.sit.earthdata.nasa.gov/kms/concepts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/rdf+xml',
        Accept: 'application/rdf+xml'
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

async function loadSchemes(versionType, version) {
  // Read the XML file
  let filePath = `../data/schemes_${version}.rdf`
  if (versionType === 'published') {
    filePath = '../data/schemes_published.rdf'
  }

  const xmlData = fs.readFileSync(filePath, 'utf8')

  const response = await fetch('https://cmr.sit.earthdata.nasa.gov/kms/concepts', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/rdf+xml',
      Accept: 'application/rdf+xml'
    },
    body: xmlData
  })

  if (!response.ok) {
    console.error('Error loading schemes.rdf')
  }

  console.log('Success: ', await response.text())
}

/**
 * Main function to load SKOS concepts and schemes into a SPARQL endpoint for all version types and versions.
 *
 * This function orchestrates the loading process for GCMD (Global Change Master Directory)
 * keyword concepts and schemes. It performs the following steps:
 * 1. Iterates through version types: 'published', 'draft', and 'past_published'.
 * 2. For each version type:
 *    a. Fetches all available versions.
 *    b. For each version:
 *       i. Loads concepts from the corresponding RDF file into the SPARQL endpoint.
 *       ii. Loads schemes from the corresponding RDF file into the SPARQL endpoint.
 *
 * @async
 * @function main
 * @throws {Error} If there's an issue fetching versions, loading concepts, or loading schemes.
 *
 * @example
 * // To run the loading process:
 * main().catch(error => console.error('Loading process failed:', error));
 *
 * @note This function assumes that RDF files for concepts and schemes are present in the '../data/' directory
 *       with naming conventions 'concepts_<version>.rdf' and 'schemes_<version>.rdf' respectively.
 *       For the 'published' version type, it uses 'concepts_published.rdf' and 'schemes_published.rdf'.
 *
 * @see Related functions:
 * {@link fetchVersions}
 * {@link loadConcepts}
 * {@link loadSchemes}
 */
const main = async () => {
  try {
    const versionTypes = ['published', 'draft', 'past_published']
    for (const versionType of versionTypes) {
      const versions = await fetchVersions(versionType)

      // eslint-disable-next-line no-restricted-syntax
      for (const version of versions) {
        try {
          await loadConcepts(versionType, version)
          console.log('All concepts loaded successfully')
          await loadSchemes(versionType, version)
          console.log('All schemes loaded successfully')
        } catch (error) {
          console.error('Error loading concepts:', error)
        }
      }
    }
  } catch (error) {
    console.error('Conversion failed:', error)
    process.exit(1)
  }
}

main()
