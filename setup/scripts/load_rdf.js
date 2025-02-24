/* eslint-disable no-await-in-loop */
/* eslint-disable no-promise-executor-return */

const fs = require('fs')

const { XMLParser, XMLBuilder } = require('fast-xml-parser')

/**
 * Creates a delay of the specified milliseconds.
 *
 * @param {number} ms - The number of milliseconds to delay.
 * @returns {Promise} A promise that resolves after the specified delay.
 */
function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Loads SKOS concepts from an RDF/XML file into a SPARQL endpoint in batches.
 *
 * @async
 * @param {string} filePath - The path to the RDF/XML file containing the concepts.
 * @param {number} [batchSize=100] - The number of concepts to send in each batch.
 */
async function loadConcepts(filePath, batchSize = 100) {
  // Read the XML file
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

  for (let i = 0; i < concepts.length; i += 100) {
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

    // Add a delay of 100 ms between each batch
    await delay(100)
  }
}

async function main() {
  try {
    await loadConcepts('../data/convertedConcepts.rdf')
    console.log('All concepts loaded successfully')
  } catch (error) {
    console.error('Error loading concepts:', error)
  }
}

main()
