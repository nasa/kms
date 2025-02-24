/* eslint-disable no-await-in-loop */
const fs = require('fs').promises
const path = require('path')

const { XMLParser, XMLBuilder } = require('fast-xml-parser')

const toRDF = require('./toRDF')

// STAGE 1 fetches all uuids from gcmd and puts them in an array
async function fetchUUIDs() {
  const baseUrl = 'https://gcmd.earthdata.nasa.gov/kms/concepts?format=json'
  const pageSize = 2000
  let allUUIDs = []
  let currentPage = 1
  let totalPages = 1

  try {
    while (currentPage <= totalPages) {
      const url = `${baseUrl}&page_num=${currentPage}&page_size=${pageSize}`
      console.log(`STAGE 1: Fetching UUIDs from page ${currentPage}...`)

      const response = await fetch(url)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const data = await response.json()
      if (!data.concepts || !Array.isArray(data.concepts)) {
        throw new Error('Unexpected data structure: concepts array not found')
      }

      allUUIDs = allUUIDs.concat(data.concepts.map((concept) => concept.uuid))

      // Update total pages on first fetch
      if (currentPage === 1) {
        totalPages = Math.ceil(data.hits / pageSize)
        console.log(`Total pages to fetch: ${totalPages}`)
      }

      currentPage += 1

      if (currentPage <= totalPages) {
        // eslint-disable-next-line no-promise-executor-return
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    console.log(`Total UUIDs fetched: ${allUUIDs.length}`)

    return allUUIDs
  } catch (error) {
    console.error('Error fetching UUIDs:', error)
    throw error
  }
}

// Helper function to fetch data based on UUIDs
const processBatch = async (uuids, concepts) => {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    textNodeName: '#text'
  })

  await Promise.all(uuids.map(async (uuid) => {
    try {
      const jsonFileURL = `https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}?format=json`
      const xmlFileURL = `https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}?format=xml`

      const processedData = await toRDF(jsonFileURL, xmlFileURL)
      const parsedData = parser.parse(processedData)

      if (parsedData['rdf:RDF'] && parsedData['rdf:RDF']['skos:Concept']) {
        concepts.push(parsedData['rdf:RDF']['skos:Concept'])
      } else {
        console.error(`Unexpected data structure for UUID ${uuid}`)
      }
    } catch (error) {
      console.error(`Error processing UUID ${uuid}:`, error)
    }
  }))
}

// Helper function for delay
const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/**
 * STAGE 2: Creates an rdf doc of all concepts by iterating through UUIDs, fetching their data in different formats, and synthesizing them into one .rdf
 * @returns convertedConcepts.rdf in setup/data
 */
const convertFilestoRDF = async () => {
  try {
    // Fetch UUIDs dynamically
    const extractedUUIDs = await fetchUUIDs()
    console.log(`STAGE 1 COMPLETE: Fetched ${extractedUUIDs.length} UUIDs`)
    const concepts = []

    // Adjust as needed. Should not see any 'failed to fetch' errors.
    const batchSize = 200
    const delayBetweenBatches = 2000

    // Creates batches for processing in processBatch
    for (let i = 0; i < extractedUUIDs.length; i += batchSize) {
      const batch = extractedUUIDs.slice(i, i + batchSize)
      // eslint-disable-next-line no-await-in-loop
      await processBatch(batch, concepts)
      console.log(`STAGE 2: Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(extractedUUIDs.length / batchSize)}`)

      // Add delay between batches
      if (i + batchSize < extractedUUIDs.length) {
        console.log(`Waiting for ${delayBetweenBatches / 1000} seconds before next batch...`)
        // eslint-disable-next-line no-await-in-loop
        await delay(delayBetweenBatches)
      }
    }

    // Create RDF structure
    const rdfObject = {
      'rdf:RDF': {
        '@_xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        '@_xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
        '@_xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#',
        'gcmd:gcmd': {
          'gcmd:hits': extractedUUIDs.length,
          'gcmd:page_num': '1',
          'gcmd:page_size': extractedUUIDs.length.toString(),
          'gcmd:termsOfUse': 'https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf',
          'gcmd:keywordVersion': '20.4.4',
          'gcmd:viewer': 'https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all'
        },
        'skos:Concept': concepts
      }
    }

    // Convert to XML
    const builder = new XMLBuilder({
      ignoreAttributes: false,
      format: true,
      indentBy: '  '
    })
    const finalRDF = builder.build(rdfObject)

    // Write file
    const outputPath = path.join(__dirname, '..', 'data', 'convertedConcepts.rdf')
    await fs.writeFile(outputPath, finalRDF)
    console.log('STAGE 2 COMPLETED: RDF file has been created: convertedConcepts.rdf')

    return outputPath
  } catch (error) {
    console.error('Error in convertFiles:', error)
    throw error
  }
}

convertFilestoRDF().then(() => {
  console.log('Conversion completed successfully.')
}).catch((error) => {
  console.error('Conversion failed:', error)
})
