const fs = require('fs').promises

// eslint-disable-next-line import/no-extraneous-dependencies
const { create } = require('xmlbuilder2')

const extractedUUIDs = require('../data/extractedUUIDs.json')

const toRDF = require('./toRDF')

// Helper function to fetch data based on UUIDs
const processBatch = async (uuids, rootDoc) => {
  await Promise.all(uuids.map(async (uuid) => {
    try {
      const jsonFileURL = `https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}?format=json`
      const xmlFileURL = `https://gcmd.earthdata.nasa.gov/kms/concept/${uuid}?format=xml`

      const processedData = await toRDF(jsonFileURL, xmlFileURL)
      const skosConceptFragment = create(processedData)
      rootDoc.root().import(skosConceptFragment.root())
    } catch (error) {
      console.error(`Error processing UUID ${uuid}:`, error)
    }
  }))
}

// Helper function for delay
const delay = (ms) => new Promise((resolve) => { setTimeout(resolve, ms) })

/**
 * Creates an rdf doc of all concepts by iterating through UUIDs, fetching their data in different formats, and synthesizing them into one .rdf
 * @returns concepts.rdf in setup/data
 */
const convertFilestoRDF = async () => {
  const { extractedUUIDs: extractedUUIDsData } = extractedUUIDs

  // Create Root Document
  try {
    const rootDoc = create({
      version: '1.0',
      encoding: 'UTF-8'
    })
      .ele('rdf:RDF', {
        'xmlns:rdf': 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
        'xmlns:skos': 'http://www.w3.org/2004/02/skos/core#',
        'xmlns:gcmd': 'https://gcmd.earthdata.nasa.gov/kms#'
      })

    const gcmdElement = rootDoc.ele('gcmd:gcmd')
    gcmdElement.ele('gcmd:hits').txt(extractedUUIDsData.length)
    gcmdElement.ele('gcmd:page_num').txt('1')
    gcmdElement.ele('gcmd:page_size').txt(extractedUUIDsData.length.toString())
    gcmdElement.ele('gcmd:termsOfUse').txt('https://cdn.earthdata.nasa.gov/conduit/upload/5182/KeywordsCommunityGuide_Baseline_v1_SIGNED_FINAL.pdf')
    gcmdElement.ele('gcmd:keywordVersion').txt('20.4.4')
    gcmdElement.ele('gcmd:viewer').txt('https://gcmd.earthdata.nasa.gov/KeywordViewer/scheme/all')

    // Adjust as needed. Should not see any 'failed to fetch' errors.
    const batchSize = 50
    const delayBetweenBatches = 2000

    // Creates batches for proccessing in processBatch
    for (let i = 0; i < extractedUUIDsData.length; i += batchSize) {
      const batch = extractedUUIDsData.slice(i, i + batchSize)
      // eslint-disable-next-line no-await-in-loop
      await processBatch(batch, rootDoc)
      console.log(`Processed batch ${Math.floor(i / batchSize) + 1} of ${Math.ceil(extractedUUIDsData.length / batchSize)}`)

      // Add delay between batches
      if (i + batchSize < extractedUUIDsData.length) {
        console.log(`Waiting for ${delayBetweenBatches / 1000} seconds before next batch...`)
        // eslint-disable-next-line no-await-in-loop
        await delay(delayBetweenBatches)
      }
    }

    // Write file
    const finalRDF = rootDoc.end({ prettyPrint: true })

    await fs.writeFile('convertedFiles.rdf', finalRDF)
    console.log('RDF file has been created: convertedFiles.rdf')
  } catch (error) {
    console.error('Error in convertFiles:', error)
  }
}

convertFilestoRDF()
